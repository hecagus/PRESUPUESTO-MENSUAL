const OLD_KEY = 'PRESUPUESTO_DATA';
const NEW_KEY = 'uber_tracker_data';

if (!localStorage.getItem(NEW_KEY)) {
  const old = localStorage.getItem(OLD_KEY);
  if (old) {
    localStorage.setItem(NEW_KEY, old);
  }
}
