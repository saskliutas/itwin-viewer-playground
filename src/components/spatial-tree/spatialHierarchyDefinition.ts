/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
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

export type IModelAccess = Props<
  typeof useIModelUnifiedSelectionTree
>["imodelAccess"];

export function createIModelAccess(imodel: IModelConnection): IModelAccess {
  const schemaProvider = createECSchemaProvider(imodel.schemaContext);
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
 *  - Level 1 (root): BuildingSpatial.Building instances
 *  - Level 2 (children of Building): BuildingSpatial.Story instances
 *  - Level 3 (children of Story): BuildingSpatial.Space instances
 */
export function getSpatialHierarchyDefinition({
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
          fullClassName: "BuildingSpatial.Building",
          query: {
            ecsql: `
              SELECT
                ${await nodesQueryFactory.createSelectClause({
                  ecClassId: { selector: "this.ECClassId" },
                  ecInstanceId: { selector: "this.ECInstanceId" },
                  nodeLabel: {
                    selector: await labelsQueryFactory.createSelectClause({
                      classAlias: "this",
                      className: "BuildingSpatial.Building",
                    }),
                  },
                })}
              FROM BuildingSpatial.Building this
            `,
          },
        },
      ],
      childNodes: [
        {
          parentInstancesNodePredicate: "BuildingSpatial.Building",
          definitions: async ({
            parentNodeInstanceIds,
          }: DefineInstanceNodeChildHierarchyLevelProps) => [
            {
              fullClassName: "BuildingSpatial.Story",
              query: {
                ecsql: `
                  SELECT
                    ${await nodesQueryFactory.createSelectClause({
                      ecClassId: { selector: "this.ECClassId" },
                      ecInstanceId: { selector: "this.ECInstanceId" },
                      nodeLabel: {
                        selector: await labelsQueryFactory.createSelectClause({
                          classAlias: "this",
                          className: "BuildingSpatial.Story",
                        }),
                      },
                    })}
                  FROM BuildingSpatial.Story this
                  INNER JOIN SpatialComposition.CompositeComposesSubComposites rel ON rel.TargetECInstanceId = this.ECInstanceId
                  WHERE rel.SourceECInstanceId IN (${parentNodeInstanceIds.map(() => "?").join(",")})
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
        {
          parentInstancesNodePredicate: "BuildingSpatial.Story",
          definitions: async ({
            parentNodeInstanceIds,
          }: DefineInstanceNodeChildHierarchyLevelProps) => [
            {
              fullClassName: "BuildingSpatial.Space",
              query: {
                ecsql: `
                  SELECT
                    ${await nodesQueryFactory.createSelectClause({
                      ecClassId: { selector: "this.ECClassId" },
                      ecInstanceId: { selector: "this.ECInstanceId" },
                      nodeLabel: {
                        selector: await labelsQueryFactory.createSelectClause({
                          classAlias: "this",
                          className: "BuildingSpatial.Space",
                        }),
                      },
                    })}
                  FROM BuildingSpatial.Space this
                  INNER JOIN SpatialComposition.CompositeComposesSubComposites rel ON rel.TargetECInstanceId = this.ECInstanceId
                  WHERE rel.SourceECInstanceId IN (${parentNodeInstanceIds.map(() => "?").join(",")})
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

export function createSpatialHierarchyProvider(imodelAccess: IModelAccess) {
  return createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: getSpatialHierarchyDefinition({ imodelAccess }),
  });
}
