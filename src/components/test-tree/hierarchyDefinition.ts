/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import {
  createECSchemaProvider,
  createECSqlQueryExecutor,
  createIModelKey,
} from "@itwin/presentation-core-interop";
import {
  createIModelHierarchyProvider,
  createLimitingECSqlQueryExecutor,
  createNodesQueryClauseFactory,
  createPredicateBasedHierarchyDefinition,
  DefineInstanceNodeChildHierarchyLevelProps,
  HierarchyDefinition,
} from "@itwin/presentation-hierarchies";
import {
  createBisInstanceLabelSelectClauseFactory,
  createCachingECClassHierarchyInspector,
  ECSqlBinding,
  Props,
} from "@itwin/presentation-shared";
import { useIModelUnifiedSelectionTree } from "@itwin/presentation-hierarchies-react";

// Cache schema contexts per iModel to avoid reloading schemas.
const imodelSchemaContextsCache = new Map<string, SchemaContext>();

function getIModelSchemaContext(imodel: IModelConnection): SchemaContext {
  const imodelKey = createIModelKey(imodel);
  let context = imodelSchemaContextsCache.get(imodelKey);
  if (!context) {
    context = new SchemaContext();
    context.addLocater(new ECSchemaRpcLocater(imodel.getRpcProps()));
    imodelSchemaContextsCache.set(imodelKey, context);
    imodel.onClose.addListener(() =>
      imodelSchemaContextsCache.delete(imodelKey),
    );
  }
  return context;
}

export type IModelAccess = Props<
  typeof useIModelUnifiedSelectionTree
>["imodelAccess"];

export function createIModelAccess(imodel: IModelConnection): IModelAccess {
  const schemaProvider = createECSchemaProvider(getIModelSchemaContext(imodel));
  return {
    imodelKey: createIModelKey(imodel),
    ...schemaProvider,
    ...createCachingECClassHierarchyInspector({
      schemaProvider,
      cacheSize: 100,
    }),
    ...createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
  };
}

/**
 * Creates a hierarchy definition that returns:
 *  - Root nodes: all BisCore.Model instances
 *  - Child nodes (per model): all BisCore.Element instances grouped by ECClass
 */
export function getHierarchyDefinition({
  imodelAccess,
}: {
  imodelAccess: IModelAccess;
}): HierarchyDefinition {
  const labelsQueryFactory = createBisInstanceLabelSelectClauseFactory({
    classHierarchyInspector: imodelAccess,
  });
  const nodesQueryFactory = createNodesQueryClauseFactory({
    imodelAccess,
    instanceLabelSelectClauseFactory: labelsQueryFactory,
  });

  return createPredicateBasedHierarchyDefinition({
    classHierarchyInspector: imodelAccess,
    hierarchy: {
      rootNodes: async () => [
        {
          fullClassName: "BisCore.Model",
          query: {
            ecsql: `
              SELECT
                ${await nodesQueryFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await labelsQueryFactory.createSelectClause({
                      classAlias: "this",
                      className: "BisCore.Model",
                    }),
                  },
                })}
              FROM BisCore.Model this
            `,
          },
        },
      ],
      childNodes: [
        {
          parentInstancesNodePredicate: "BisCore.Model",
          definitions: async ({
            parentNodeInstanceIds,
          }: DefineInstanceNodeChildHierarchyLevelProps) => [
            {
              fullClassName: "BisCore.Element",
              query: {
                ecsql: `
                  SELECT
                    ${await nodesQueryFactory.createSelectClause({
                      ecClassId: { selector: "this.ECClassId" },
                      ecInstanceId: { selector: "this.ECInstanceId" },
                      nodeLabel: {
                        selector: await labelsQueryFactory.createSelectClause({
                          classAlias: "this",
                          className: "BisCore.Element",
                        }),
                      },
                      grouping: {
                        byClass: true,
                      },
                    })}
                  FROM BisCore.Element this
                  WHERE this.Model.Id IN (${parentNodeInstanceIds.map(() => "?").join(",")})
                `,
                bindings: [
                  ...parentNodeInstanceIds.map(
                    (id): ECSqlBinding => ({ type: "id", value: id }),
                  ),
                ],
              },
            },
          ],
        },
      ],
    },
  });
}

export function createHierarchyProvider(imodelAccess: IModelAccess) {
  return createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: getHierarchyDefinition({ imodelAccess }),
  });
}
