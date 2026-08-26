"use client";

/* =============================================================================
   Overlay scrollbar — React-обёртки над vanilla-ядром.
   Канонический источник: platform-docs/methodology/overlay-scrollbar/.
   Копии в репозиториях обязаны быть побайтово равны — правь здесь, потом вендорь.

   Ядро (overlay-scrollbar.ts) от React не зависит; здесь только привязка к
   жизненному циклу компонента. Один и тот же файл работает и в Next-клиенте,
   и в Vite SPA ("use client" во втором случае просто игнорируется).
   ========================================================================== */

import { useEffect, useState } from "react";
import {
  attachOverlayScrollbar,
  type OverlayScrollbarOptions,
} from "./overlay-scrollbar";
import "./overlay-scrollbar.css";

/**
 * Оверлейная полоса прокрутки страницы. Монтируется один раз в layout/AppShell,
 * ничего не рендерит — весь свой DOM ядро создаёт само в body.
 */
export function OverlayScrollbar({
  axis,
  hideDelay,
  minThumb,
}: OverlayScrollbarOptions = {}) {
  useEffect(
    () => attachOverlayScrollbar(window, { axis, hideDelay, minThumb }),
    [axis, hideDelay, minThumb],
  );

  return null;
}

export default OverlayScrollbar;

/**
 * Оверлейная полоса для внутреннего контейнера со своим скроллом (список
 * результатов поиска, тело диалога, выпадающее меню).
 *
 * Возвращает **callback-ref**, а не принимает готовый `useRef`, — и это
 * принципиально. Объектный ref своё наполнение не сигналит: эффект отработал бы
 * один раз на монтировании обёртки, когда контейнера в DOM ещё нет. Именно так
 * устроены порталы Radix (`<SelectContent>` смонтирован всегда, а его Content
 * появляется только при открытии) и любая условная отрисовка — полоса в этих
 * случаях не подключалась бы вовсе. Callback-ref же вызывается ровно в момент
 * появления и исчезновения узла.
 *
 *     const listRef = useOverlayScrollbar<HTMLDivElement>()
 *     return <div ref={listRef} className="overflow-y-auto">…</div>
 */
export function useOverlayScrollbar<T extends HTMLElement>({
  axis,
  hideDelay,
  minThumb,
}: OverlayScrollbarOptions = {}) {
  // Через состояние, а не через ref: смена узла обязана перезапустить эффект.
  // Сеттер из useState стабилен между рендерами, поэтому как ref он не вызывает
  // лишних отцепов-подцепов на каждый рендер.
  const [node, setNode] = useState<T | null>(null);

  useEffect(() => {
    if (!node) return;
    return attachOverlayScrollbar(node, { axis, hideDelay, minThumb });
  }, [node, axis, hideDelay, minThumb]);

  return setNode;
}

export type { OverlayScrollbarOptions };
