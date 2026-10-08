function canonicalWork(tag) {
  const found = state.taxonomy.works.find((work) => work.id === tag || work.tags.includes(tag));
  return found ? found.id : tag;
}
function canonicalCharacter(tag) {
  const found = state.taxonomy.characters.find((character) => character.id === tag || character.tags.includes(tag));
  if (found) return found.id;
  const bare = tag.replace(/_\([^)]+\)$/, "");
  const byBare = state.taxonomy.characters.find((character) => character.id === bare || character.tags.includes(bare));
  return byBare ? byBare.id : tag;
}
function workTags(item) {
  const known = new Set(state.taxonomy.works.flatMap((work) => [work.id, ...work.tags]));
  return [...new Set([...norm(item.copyright_tags), ...norm(item.tags).filter((tag) => known.has(tag))].map(canonicalWork))];
}
function characterTags(item) {
  const known = new Set(state.taxonomy.characters.flatMap((character) => [character.id, ...character.tags]));
  return [...new Set([...norm(item.character_tags), ...norm(item.tags).filter((tag) => known.has(tag))].map(canonicalCharacter))];
}
