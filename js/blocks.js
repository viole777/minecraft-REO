/* Mundo de Blocos - registro de blocos (original) */
;((g) => {
const VX = g.VX = g.VX || {};

const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5,
  LOG: 6, PLANKS: 7, LEAVES: 8, BRICKS: 9, SNOW: 10, GLASS: 11,
  WATER: 12, GRAVEL: 13, COAL_ORE: 14, IRON_ORE: 15, BEDROCK: 16,
  TALLGRASS: 17, POPPY: 18, DANDELION: 19, SANDSTONE: 20,
  STONE_BRICK: 21, OBSIDIAN: 22
};
VX.Blocks = B;

const defs = {};

function def(id, name, tiles, opts) {
  defs[id] = Object.assign({
    id, name, tiles,
    solid: true, opaque: true, cross: false, liquid: false, breakable: true
  }, opts);
}

def(B.GRASS, 'Grama', { top: 'grass_top', side: 'grass_side', bottom: 'dirt' });
def(B.DIRT, 'Terra', { top: 'dirt', side: 'dirt', bottom: 'dirt' });
def(B.STONE, 'Pedra', { top: 'stone', side: 'stone', bottom: 'stone' });
def(B.COBBLE, 'Pedregulho', { top: 'cobble', side: 'cobble', bottom: 'cobble' });
def(B.SAND, 'Areia', { top: 'sand', side: 'sand', bottom: 'sand' });
def(B.LOG, 'Tronco', { top: 'log_top', side: 'log_side', bottom: 'log_top' });
def(B.PLANKS, 'Tábuas', { top: 'planks', side: 'planks', bottom: 'planks' });
def(B.LEAVES, 'Folhas', { top: 'leaves', side: 'leaves', bottom: 'leaves' }, { opaque: false });
def(B.BRICKS, 'Tijolos', { top: 'bricks', side: 'bricks', bottom: 'bricks' });
def(B.SNOW, 'Neve', { top: 'snow', side: 'snow_side', bottom: 'dirt' });
def(B.GLASS, 'Vidro', { top: 'glass', side: 'glass', bottom: 'glass' }, { opaque: false });
def(B.WATER, 'Água', { top: 'water', side: 'water', bottom: 'water' },
  { solid: false, opaque: false, liquid: true, breakable: false });
def(B.GRAVEL, 'Cascalho', { top: 'gravel', side: 'gravel', bottom: 'gravel' });
def(B.COAL_ORE, 'Minério de Carvão', { top: 'coal_ore', side: 'coal_ore', bottom: 'coal_ore' });
def(B.IRON_ORE, 'Minério de Ferro', { top: 'iron_ore', side: 'iron_ore', bottom: 'iron_ore' });
def(B.BEDROCK, 'Rocha-mãe', { top: 'bedrock', side: 'bedrock', bottom: 'bedrock' },
  { breakable: false });
def(B.TALLGRASS, 'Grama Alta', { top: 'tallgrass', side: 'tallgrass', bottom: 'tallgrass' },
  { solid: false, opaque: false, cross: true });
def(B.POPPY, 'Papoula', { top: 'poppy', side: 'poppy', bottom: 'poppy' },
  { solid: false, opaque: false, cross: true });
def(B.DANDELION, 'Dente-de-leão', { top: 'dandelion', side: 'dandelion', bottom: 'dandelion' },
  { solid: false, opaque: false, cross: true });
def(B.SANDSTONE, 'Arenito', { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_top' });
def(B.STONE_BRICK, 'Pedra Lavrada', { top: 'stone_brick', side: 'stone_brick', bottom: 'stone_brick' });
def(B.OBSIDIAN, 'Obsidiana', { top: 'obsidian', side: 'obsidian', bottom: 'obsidian' });

VX.blockDef = function (id) { return defs[id]; };
VX.isOpaque = function (id) { return id !== 0 && !!defs[id].opaque; };
VX.isSolid = function (id) { return id !== 0 && !!defs[id].solid; };
VX.isCross = function (id) { return id !== 0 && !!defs[id].cross; };
VX.isLiquid = function (id) { return id !== 0 && !!defs[id].liquid; };
VX.isBreakable = function (id) { return id !== 0 && !!defs[id].breakable; };
VX.isReplaceable = function (id) {
  return id === 0 || !!defs[id].liquid || !!defs[id].cross;
};

/* Ordem do inventário criativo */
VX.itemList = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.SAND, B.GRAVEL, B.SANDSTONE,
  B.LOG, B.PLANKS, B.LEAVES, B.BRICKS, B.STONE_BRICK, B.GLASS,
  B.SNOW, B.OBSIDIAN, B.COAL_ORE, B.IRON_ORE, B.BEDROCK,
  B.TALLGRASS, B.POPPY, B.DANDELION, B.WATER
];

VX.hotbarDefault = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.LOG, B.PLANKS, B.GLASS, B.SAND, B.BRICKS];

})(typeof window !== 'undefined' ? window : globalThis);
