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
  getSpatialHierarchyDefinition,
  IModelAccess,
} from "./spatialHierarchyDefinition";

/**
 * Tree component that displays spatial data in a 3-level hierarchy:
 *  - Level 1: Buildings (BuildingSpatial.Building)
 *  - Level 2: Stories (BuildingSpatial.Story)
 *  - Level 3: Spaces (BuildingSpatial.Space)
 */
export function SpatialTree() {
  const imodel = useActiveIModelConnection();
  if (!imodel) {
    return null;
  }
  return <SpatialTreeWithIModel imodel={imodel} />;
}

interface SpatialTreeWithIModelProps {
  imodel: IModelConnection;
}

function SpatialTreeWithIModel({ imodel }: SpatialTreeWithIModelProps) {
  const [imodelAccess, setIModelAccess] = useState<IModelAccess | undefined>(
    undefined,
  );

  useEffect(() => {
    setIModelAccess(createIModelAccess(imodel));
  }, [imodel]);

  if (!imodelAccess) {
    return null;
  }

  return <SpatialTreeInternal imodelAccess={imodelAccess} />;
}

interface SpatialTreeInternalProps {
  imodelAccess: IModelAccess;
}

function SpatialTreeInternal({ imodelAccess }: SpatialTreeInternalProps) {
  const { rootNodes, isLoading, ...state } = useIModelUnifiedSelectionTree({
    selectionStorage,
    sourceName: "SpatialTree",
    imodelAccess,
    getHierarchyDefinition: getSpatialHierarchyDefinition,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!rootNodes) {
    return null;
  }

  return <TreeRenderer {...state} rootNodes={rootNodes} />;
}
