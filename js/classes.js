// Общий список финальных (3rd) классов Lineage 2 с иконками — используется везде,
// где нужно показать/выбрать класс персонажа (сейчас: «Проверка буста»).
// Тот же набор классов, что в CLASSES внутри panel.html (панель скиллов), но плоским
// списком без привязки к расе — картинки лежат в assets/classes/<slug>.png.
window.L2_CLASSES = [
  { name: "Dreadnought", icon: "assets/classes/dreadnought.webp" },
  { name: "Duelist", icon: "assets/classes/duelist.webp" },
  { name: "Phoenix Knight", icon: "assets/classes/phoenix-knight.webp" },
  { name: "Hell Knight", icon: "assets/classes/hell-knight.webp" },
  { name: "Adventurer", icon: "assets/classes/adventurer.webp" },
  { name: "Sagittarius", icon: "assets/classes/sagittarius.webp" },
  { name: "Archmage", icon: "assets/classes/archmage.webp" },
  { name: "Soultaker", icon: "assets/classes/soultaker.webp" },
  { name: "Arcana Lord", icon: "assets/classes/arcana-lord.webp" },
  { name: "Cardinal", icon: "assets/classes/cardinal.webp" },
  { name: "Hierophant", icon: "assets/classes/hierophant.webp" },
  { name: "Eva's Templar", icon: "assets/classes/evas-templar.webp" },
  { name: "Sword Muse", icon: "assets/classes/sword-muse.webp" },
  { name: "Wind Rider", icon: "assets/classes/wind-rider.webp" },
  { name: "Moonlight Sentinel", icon: "assets/classes/moonlight-sentinel.webp" },
  { name: "Mystic Muse", icon: "assets/classes/mystic-muse.webp" },
  { name: "Elemental Master", icon: "assets/classes/elemental-master.webp" },
  { name: "Eva's Saint", icon: "assets/classes/evas-saint.webp" },
  { name: "Shillien Templar", icon: "assets/classes/shillien-templar.webp" },
  { name: "Spectral Dancer", icon: "assets/classes/spectral-dancer.webp" },
  { name: "Ghost Hunter", icon: "assets/classes/ghost-hunter.webp" },
  { name: "Ghost Sentinel", icon: "assets/classes/ghost-sentinel.webp" },
  { name: "Storm Screamer", icon: "assets/classes/storm-screamer.webp" },
  { name: "Spectral Master", icon: "assets/classes/spectral-master.webp" },
  { name: "Shillien Saint", icon: "assets/classes/shillien-saint.webp" },
  { name: "Titan", icon: "assets/classes/titan.webp" },
  { name: "Grand Khavatari", icon: "assets/classes/grand-khavatari.webp" },
  { name: "Dominator", icon: "assets/classes/dominator.webp" },
  { name: "Doomcryer", icon: "assets/classes/doomcryer.webp" },
  { name: "Fortune Seeker", icon: "assets/classes/fortune-seeker.webp" },
  { name: "Maestro", icon: "assets/classes/maestro.webp" },
  { name: "Doombringer", icon: "assets/classes/doombringer.webp" },
  { name: "Soul Hound", icon: "assets/classes/soul-hound.webp" },
  { name: "Judicator", icon: "assets/classes/judicator.webp" },
  { name: "Female Soul Hound", icon: "assets/classes/female-soul-hound.webp" },
  { name: "Trickster", icon: "assets/classes/trickster.webp" },
].sort((a, b) => a.name.localeCompare(b.name));

window.L2_CLASS_ICON = (className) => {
  const found = window.L2_CLASSES.find(c => c.name === className);
  return found ? found.icon : null;
};
