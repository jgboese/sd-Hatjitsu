import { useEffect, useRef, useState } from 'react';
import type { CardPack } from '../../../server/protocol.ts';
import { CARD_PACK_LABELS } from '../voting.ts';

const CARD_PACKS = Object.keys(CARD_PACK_LABELS) as CardPack[];

/** The admin's menu for switching the room's card pack. */
export function CardPackDropdown({
  cardPack,
  onSelect,
}: {
  cardPack: CardPack;
  onSelect: (cardPack: CardPack) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('click', closeOnOutsideClick);
    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
    };
  }, [open]);

  return (
    // Clicking the menu toggles it; picking a pack bubbles up here and closes it.
    <div
      ref={wrapper}
      className={open ? 'dropdown-wrapper btn active' : 'dropdown-wrapper btn'}
      onClick={() => {
        setOpen(!open);
      }}
    >
      <span>{CARD_PACK_LABELS[cardPack]} pack</span>
      <ul className="dropdown">
        {CARD_PACKS.map((pack) => (
          <li className="dropdown__item" key={pack}>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onSelect(pack);
              }}
            >
              {CARD_PACK_LABELS[pack]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
