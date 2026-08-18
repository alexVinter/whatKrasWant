export function scrollToHomeSection(sectionId: string) {
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
