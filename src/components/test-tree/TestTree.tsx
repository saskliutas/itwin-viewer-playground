/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { IModelConnection } from "@itwin/core-frontend";
import {
  TreeRenderer,
  useIModelUnifiedSelectionTree,
} from "@itwin/presentation-hierarchies-react";
import { selectionStorage } from "../../selectionStorage";
import {
  createIModelAccess,
  getHierarchyDefinition,
  IModelAccess,
} from "./hierarchyDefinition";

/**
 * Tree component that displays BisCore.Model instances at the root level
 * and their child BisCore.Element instances grouped by ECClass.
 *
 * Uses the active iModel connection from the AppUI context.
 */
export function TestTree() {
  const imodel = useActiveIModelConnection();
  if (!imodel) {
    return null;
  }
  return <TestTreeWithIModel imodel={imodel} />;
}

interface TestTreeWithIModelProps {
  imodel: IModelConnection;
}

function TestTreeWithIModel({ imodel }: TestTreeWithIModelProps) {
  const [imodelAccess, setIModelAccess] = useState<IModelAccess | undefined>(
    undefined,
  );

  useEffect(() => {
    setIModelAccess(createIModelAccess(imodel));
  }, [imodel]);

  if (!imodelAccess) {
    return null;
  }

  return <TestTreeInternal imodelAccess={imodelAccess} />;
}

interface TestTreeInternalProps {
  imodelAccess: IModelAccess;
}

function TestTreeInternal({ imodelAccess }: TestTreeInternalProps) {
  const { rootNodes, isLoading, ...state } = useIModelUnifiedSelectionTree({
    selectionStorage,
    sourceName: "TestTree",
    imodelAccess,
    getHierarchyDefinition,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!rootNodes) {
    return null;
  }

  return <TreeRenderer {...state} rootNodes={rootNodes} />;
}
