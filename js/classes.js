// Общий список финальных (3rd) классов Lineage 2 с иконками — используется везде,
// где нужно показать/выбрать класс персонажа (сейчас: «Проверка буста»).
// Тот же набор классов, что в CLASSES внутри panel.html (панель скиллов), но плоским
// списком без привязки к расе — картинки лежат в assets/classes/<slug>.png.
window.L2_CLASSES = [
  { name: "Dreadnought", icon: "assets/classes/dreadnought.png" },
  { name: "Duelist", icon: "assets/classes/duelist.png" },
  { name: "Phoenix Knight", icon: "assets/classes/phoenix-knight.png" },
  { name: "Hell Knight", icon: "assets/classes/hell-knight.png" },
  { name: "Adventurer", icon: "assets/classes/adventurer.png" },
  { name: "Sagittarius", icon: "assets/classes/sagittarius.png" },
  { name: "Archmage", icon: "assets/classes/archmage.png" },
  { name: "Soultaker", icon: "assets/classes/soultaker.png" },
  { name: "Arcana Lord", icon: "assets/classes/arcana-lord.png" },
  { name: "Cardinal", icon: "assets/classes/cardinal.png" },
  { name: "Hierophant", icon: "assets/classes/hierophant.png" },
  { name: "Eva's Templar", icon: "assets/classes/evas-templar.png" },
  { name: "Sword Muse", icon: "assets/classes/sword-muse.png" },
  { name: "Wind Rider", icon: "assets/classes/wind-rider.png" },
  { name: "Moonlight Sentinel", icon: "assets/classes/moonlight-sentinel.png" },
  { name: "Mystic Muse", icon: "assets/classes/mystic-muse.png" },
  { name: "Elemental Master", icon: "assets/classes/elemental-master.png" },
  { name: "Eva's Saint", icon: "assets/classes/evas-saint.png" },
  { name: "Shillien Templar", icon: "assets/classes/shillien-templar.png" },
  { name: "Spectral Dancer", icon: "assets/classes/spectral-dancer.png" },
  { name: "Ghost Hunter", icon: "assets/classes/ghost-hunter.png" },
  { name: "Ghost Sentinel", icon: "assets/classes/ghost-sentinel.png" },
  { name: "Storm Screamer", icon: "assets/classes/storm-screamer.png" },
  { name: "Spectral Master", icon: "assets/classes/spectral-master.png" },
  { name: "Shillien Saint", icon: "assets/classes/shillien-saint.png" },
  { name: "Titan", icon: "assets/classes/titan.png" },
  { name: "Grand Khavatari", icon: "assets/classes/grand-khavatari.png" },
  { name: "Dominator", icon: "assets/classes/dominator.png" },
  { name: "Doomcryer", icon: "assets/classes/doomcryer.png" },
  { name: "Fortune Seeker", icon: "assets/classes/fortune-seeker.png" },
  { name: "Maestro", icon: "assets/classes/maestro.png" },
  { name: "Doombringer", icon: "assets/classes/doombringer.png" },
  { name: "Soul Hound", icon: "assets/classes/soul-hound.png" },
  { name: "Judicator", icon: "assets/classes/judicator.png" },
  { name: "Female Soul Hound", icon: "assets/classes/female-soul-hound.png" },
  { name: "Trickster", icon: "assets/classes/trickster.png" },
].sort((a, b) => a.name.localeCompare(b.name));

window.L2_CLASS_ICON = (className) => {
  const found = window.L2_CLASSES.find(c => c.name === className);
  return found ? found.icon : null;
};
