export function initPricingToggle(): void {
  const toggle = document.querySelector('[data-pricing-toggle]');
  if (!toggle) return;

  const buttons = Array.from(toggle.querySelectorAll<HTMLButtonElement>('[data-cycle]'));
  const amounts = Array.from(document.querySelectorAll<HTMLElement>('.price-amount'));
  const periods = Array.from(document.querySelectorAll<HTMLElement>('.price-period'));
  let cycle: 'monthly' | 'yearly' = 'monthly';

  const applyButton = (btn: HTMLButtonElement, on: boolean) => {
    const onClasses = (btn.dataset.on ?? '').split(' ').filter(Boolean);
    const offClasses = (btn.dataset.off ?? '').split(' ').filter(Boolean);
    btn.classList.remove(...onClasses, ...offClasses);
    btn.classList.add(...(on ? onClasses : offClasses));
  };

  const render = () => {
    buttons.forEach((btn) => applyButton(btn, btn.dataset.cycle === cycle));
    amounts.forEach((el) => {
      el.textContent = el.dataset[cycle] ?? el.textContent;
    });
    periods.forEach((el) => {
      el.textContent = el.dataset[cycle === 'yearly' ? 'periodYearly' : 'periodMonthly'] ?? el.textContent;
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      cycle = btn.dataset.cycle as 'monthly' | 'yearly';
      render();
    });
  });

  render();
}
