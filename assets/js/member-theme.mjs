// Seasons use northern-hemisphere months; time is interpreted in the chosen zone.
export function getThemePeriod(date = new Date(), timeZone = 'Asia/Tokyo') {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', month: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  }
  const month = Number(parts.find(p => p.type === 'month').value);
  const hour = Number(parts.find(p => p.type === 'hour').value);
  const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  const time = hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'evening' : 'night';
  return { season, time };
}

export function resolveThemeName(settings = {}, presets, date = new Date()) {
  const { season, time } = getThemePeriod(date, settings.timeZone);
  const selected = settings.theme || 'default';
  let name = selected;
  if (selected === 'auto-season') name = settings.seasons?.[season] || season;
  if (selected === 'auto-time') name = settings.times?.[time] || time;
  if (selected === 'auto') name = settings.schedule?.[season]?.[time] || season + '-' + time;
  return typeof name === 'string' && Object.hasOwn(presets, name) ? name : 'default';
}

// Validate theme colors before passing settings into CSS custom properties.
const isColor = value => typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
const fields = { title_color: 'title', icon_color: 'accent', text_color: 'text', bg_color: 'background', border_color: 'border' };
export function applyMemberTheme(card, settings, presets, date = new Date()) {
  if (!settings) return;
  const preset = presets[resolveThemeName(settings, presets, date)];
  if (preset?.light && preset?.dark) {
    for (const mode of ['light', 'dark']) {
      for (const [field, variable] of Object.entries(fields)) {
        const value = preset[mode][field];
        if (!isColor(value)) continue;
        card.style.setProperty(`--member-${variable}-${mode}`, value);
      }
    }
    card.classList.add('has-member-theme', 'has-member-color');
  }
  if (isColor(settings?.color)) {
    card.style.setProperty('--member-accent-light', settings.color);
    card.style.setProperty('--member-accent-dark', settings.color);
    card.classList.add('has-member-color');
  }
}
