function element(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function appendProfile(card, profile, scriptUrl) {
  if (!profile || typeof profile !== 'object') return;
  const heading = card.querySelector('h3');
  if (typeof profile.displayName === 'string' && heading) heading.textContent = profile.displayName;
  if (typeof profile.bio === 'string') card.append(element('p',profile.bio,'member-bio'));
  if (Array.isArray(profile.skills)) {
    const tags=element('div','','tags');
    for(const skill of profile.skills) if(typeof skill==='string') tags.append(element('span',skill));
    card.append(tags);
  }
  const work=profile.work || {};
  const images=Array.isArray(profile.images)?profile.images:[];
  if (!work.title && !work.description && !work.url && !images.length) return;
  const details=element('details','','member-work');
  details.append(element('summary','作品を見る'));
  if (work.title) details.append(element('h4',work.title));
  if (work.description) details.append(element('p',work.description,'member-bio'));
  for(const path of images) {
    if(typeof path!=='string' || !/^assets\/images\/members\/[a-z0-9-]+\.(png|jpg|webp)$/.test(path)) continue;
    const image=document.createElement('img');image.src=new URL('../../'+path,scriptUrl).href;
    image.alt=work.description || work.title || 'メンバーの作品';image.loading='lazy';
    image.className='member-work-image';details.append(image);
  }
  try {
    const url=new URL(work.url);
    if(url.protocol==='https:' && !url.username && !url.password) {
      const link=element('a','作品を開く ↗','text-link');link.href=url.href;details.append(link);
    }
  } catch { /* A project URL is optional. */ }
  card.append(details);
}
