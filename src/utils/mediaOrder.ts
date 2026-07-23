interface MediaBlock {
  _block: string;
}

interface MediaGroup<TBlock extends MediaBlock> {
  blocks: TBlock[];
}

export interface IndexedMediaGroup<TGroup> {
  group: TGroup;
  mediaStartIndex: number;
  imageStartIndex: number;
}

export interface IndexedMediaBlock<TBlock> {
  block: TBlock;
  mediaIndex: number;
  imageIndex: number;
}

/** Adds stable cross-group media and image start indices. */
export const indexMediaGroups = <
  TBlock extends MediaBlock,
  TGroup extends MediaGroup<TBlock>,
>(
  groups: TGroup[],
): IndexedMediaGroup<TGroup>[] => {
  let mediaIndex = 0;
  let imageIndex = 0;

  return groups.map((group) => {
    const indexedGroup = {
      group,
      mediaStartIndex: mediaIndex,
      imageStartIndex: imageIndex,
    };

    for (const block of group.blocks) {
      if (block._block === "image" || block._block === "video") {
        mediaIndex += 1;
      }
      if (block._block === "image") {
        imageIndex += 1;
      }
    }

    return indexedGroup;
  });
};

/** Adds media and image indices to every block within one group. */
export const indexMediaBlocks = <TBlock extends MediaBlock>(
  blocks: TBlock[],
  mediaStartIndex: number,
  imageStartIndex: number,
): IndexedMediaBlock<TBlock>[] => {
  let mediaIndex = mediaStartIndex;
  let imageIndex = imageStartIndex;

  return blocks.map((block) => {
    const indexedBlock = { block, mediaIndex, imageIndex };

    if (block._block === "image" || block._block === "video") {
      mediaIndex += 1;
    }
    if (block._block === "image") {
      imageIndex += 1;
    }

    return indexedBlock;
  });
};
