/* =============================================================================
   Overlay scrollbar — vanilla-ядро (без React).
   Канонический источник: platform-docs/methodology/overlay-scrollbar/.
   Копии в репозиториях обязаны быть побайтово равны — правь здесь, потом вендорь.

   Идея: нативный скролл остаётся нативным (колесо, клавиатура, тач, скролл-якоря),
   нативная полоса скрыта через CSS, а поверх контента рисуется собственная полоса,
   которая НЕ занимает ширину вьюпорта. Контент не «прыгает» между страницами с
   прокруткой и без неё, и справа нет вечного пустого жёлоба.
   ========================================================================== */

export type OverlayScrollbarAxis = "y" | "x" | "both";

export interface OverlayScrollbarOptions {
  /** Какие оси обслуживать. По умолчанию только вертикаль. */
  axis?: OverlayScrollbarAxis;
  /** Через сколько мс после последнего скролла прячем полосу. */
  hideDelay?: number;
  /** Минимальный размер бегунка, чтобы он не вырождался на длинном контенте. */
  minThumb?: number;
}

export interface ThumbGeometry {
  /** Длина бегунка вдоль оси, px. */
  size: number;
  /** Смещение бегунка от начала трека, px. */
  offset: number;
}

export const OSB_HIDE_DELAY = 900;
export const OSB_MIN_THUMB = 40;

/** Ниже этого запаса прокрутки (px) считаем, что скроллить нечего. */
const MIN_SCROLLABLE = 1;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Геометрия бегунка. Чистая функция — вся арифметика полосы живёт здесь и
 * покрыта юнит-тестами; DOM-часть ниже только раскладывает результат в style.
 *
 * `null` — полосы быть не должно: контейнер не скроллится (`maxScroll <= 0`),
 * размеры ещё не измерены (0) или пришёл мусор (NaN, отрицательные значения).
 */
export function computeThumb(
  viewport: number,
  content: number,
  scroll: number,
  minThumb: number = OSB_MIN_THUMB,
): ThumbGeometry | null {
  if (!Number.isFinite(viewport) || !Number.isFinite(content)) return null;
  if (viewport <= 0 || content <= 0) return null;

  const maxScroll = content - viewport;
  if (maxScroll < MIN_SCROLLABLE) return null;

  // Бегунок пропорционален видимой доле контента, но не короче minThumb и не
  // длиннее самого трека (minThumb на крошечном контейнере не должен его порвать).
  const proportional = (viewport / content) * viewport;
  const floor = Math.min(minThumb, viewport);
  const size = clamp(proportional, floor, viewport);

  const travel = viewport - size;
  const progress =
    travel <= 0 || !Number.isFinite(scroll) ? 0 : clamp(scroll / maxScroll, 0, 1);

  return { size, offset: progress * travel };
}

/**
 * Обратное преобразование: смещение бегунка → позиция скролла. Нужно для drag и
 * клика по треку. Клампы те же, что в computeThumb, — тянуть за пределы трека
 * можно, но скролл упрётся в границы.
 */
export function scrollFromThumbOffset(
  offset: number,
  viewport: number,
  content: number,
  minThumb: number = OSB_MIN_THUMB,
): number {
  const geometry = computeThumb(viewport, content, 0, minThumb);
  if (!geometry) return 0;

  const travel = viewport - geometry.size;
  if (travel <= 0) return 0;

  return (clamp(offset, 0, travel) / travel) * (content - viewport);
}

/**
 * Окно это или элемент. Проверяем по nodeType, а не через `instanceof Window`:
 * последний врёт, когда объект пришёл из другого реалма — так ведёт себя window
 * в jsdom под Vitest, и так же повёл бы себя window внутри iframe.
 */
const isWindowTarget = (target: HTMLElement | Window): target is Window =>
  typeof (target as HTMLElement).nodeType !== "number";

/**
 * Вешает оверлейную полосу на окно или на любой элемент с overflow: auto/scroll.
 * Возвращает функцию отписки — снимает слушатели, наблюдатели и весь свой DOM.
 *
 * Окно → трек `position: fixed` по вьюпорту. Элемент → обёртка `position: absolute`
 * в его родителе (родителю при необходимости выставляется `position: relative`),
 * повторяющая коробку контейнера; сама обёртка `pointer-events: none`, кликабелен
 * только узкий трек внутри неё.
 */
export function attachOverlayScrollbar(
  target: HTMLElement | Window,
  options: OverlayScrollbarOptions = {},
): () => void {
  // SSR / нода без DOM: молча ничего не делаем — вызывающий код не обязан
  // проверять окружение сам.
  if (typeof document === "undefined" || !target) return () => {};

  const {
    axis = "y",
    hideDelay = OSB_HIDE_DELAY,
    minThumb = OSB_MIN_THUMB,
  } = options;

  const toWindow = isWindowTarget(target);
  const host = toWindow ? null : (target as HTMLElement);
  // Метрики контента у окна берём с documentElement, а не с body: body может быть
  // короче документа (margin collapsing, flex-колонка) и полоса выйдет неверной.
  const scroller = toWindow ? document.documentElement : (host as HTMLElement);
  const eventTarget: EventTarget = toWindow ? window : (host as HTMLElement);

  // Родитель нужен только для элементного режима — там обёртка живёт рядом с
  // контейнером, а не внутри него (внутри она бы уехала вместе с контентом).
  const parent = host?.parentElement ?? null;
  if (!toWindow && !parent) return () => {};

  const axes: ("y" | "x")[] =
    axis === "both" ? ["y", "x"] : [axis as "y" | "x"];

  // --- DOM ------------------------------------------------------------------

  const root = document.createElement("div");
  root.className = toWindow ? "osb osb--fixed" : "osb osb--boxed";
  if (axis === "both") root.classList.add("osb--both");
  // Полоса чисто визуальная: нативный скролл цел, скринридеру тут читать нечего.
  root.setAttribute("aria-hidden", "true");

  let restoreParentPosition: string | null = null;
  if (toWindow) {
    document.body.appendChild(root);
  } else {
    const parentEl = parent as HTMLElement;
    // Обёртка позиционируется абсолютно — родителю нужен position, иначе она
    // отсчитается от произвольного предка выше по дереву.
    if (getComputedStyle(parentEl).position === "static") {
      restoreParentPosition = parentEl.style.position;
      parentEl.style.position = "relative";
    }
    parentEl.appendChild(root);
    // Класс-маркер прячет нативную полосу конкретно этого контейнера.
    (host as HTMLElement).classList.add("osb-host");
  }

  interface AxisParts {
    axis: "y" | "x";
    track: HTMLDivElement;
    thumb: HTMLDivElement;
    dragging: boolean;
    /** Смещение точки захвата от начала бегунка при drag. */
    grab: number;
  }

  const parts: AxisParts[] = axes.map((a) => {
    const track = document.createElement("div");
    track.className = `osb-track osb-track--${a}`;
    const thumb = document.createElement("div");
    thumb.className = "osb-thumb";
    track.appendChild(thumb);
    root.appendChild(track);
    return { axis: a, track, thumb, dragging: false, grab: 0 };
  });

  // --- Метрики --------------------------------------------------------------

  // Видимый размер: у окна — clientHeight/Width корневого элемента (нативная
  // полоса скрыта, так что это же и innerWidth), у контейнера — его client-бокс.
  const viewportOf = (a: "y" | "x") =>
    a === "y" ? scroller.clientHeight : scroller.clientWidth;

  const contentOf = (a: "y" | "x") =>
    a === "y" ? scroller.scrollHeight : scroller.scrollWidth;

  const scrollOf = (a: "y" | "x") => {
    if (toWindow) return a === "y" ? window.scrollY : window.scrollX;
    const el = host as HTMLElement;
    return a === "y" ? el.scrollTop : el.scrollLeft;
  };

  const scrollTo = (a: "y" | "x", value: number) => {
    if (toWindow) {
      // behavior: "auto" — во время drag плавная прокрутка отстаёт от курсора.
      window.scrollTo(
        a === "y"
          ? { top: value, behavior: "auto" }
          : { left: value, behavior: "auto" },
      );
      return;
    }
    const el = host as HTMLElement;
    if (a === "y") el.scrollTop = value;
    else el.scrollLeft = value;
  };

  // На тач-устройствах нативные полосы уже оверлейные и ширину не занимают —
  // своя там только мешает. CSS её прячет, а мы ещё и не считаем геометрию.
  const coarse =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)")
      : null;
  const isCoarse = () => coarse?.matches ?? false;

  // --- Отрисовка ------------------------------------------------------------

  let raf = 0;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const update = () => {
    raf = 0;
    if (isCoarse()) return;

    // Элементный режим: обёртка повторяет коробку контейнера в координатах
    // родителя. Родитель позиционирован (см. выше), поэтому offsetParent хоста —
    // именно он, и offsetTop/Left дают нужные числа без возни с rect.
    if (!toWindow) {
      const el = host as HTMLElement;
      root.style.top = `${el.offsetTop}px`;
      root.style.left = `${el.offsetLeft}px`;
      root.style.width = `${el.offsetWidth}px`;
      root.style.height = `${el.offsetHeight}px`;
    }

    for (const part of parts) {
      const a = part.axis;
      const geometry = computeThumb(
        viewportOf(a),
        contentOf(a),
        scrollOf(a),
        minThumb,
      );

      if (!geometry) {
        // Скроллить нечего — полоса не видна и не ловит клики.
        part.track.classList.add("osb-track--disabled");
        continue;
      }

      part.track.classList.remove("osb-track--disabled");
      if (a === "y") {
        part.thumb.style.height = `${geometry.size}px`;
        part.thumb.style.transform = `translateY(${geometry.offset}px)`;
      } else {
        part.thumb.style.width = `${geometry.size}px`;
        part.thumb.style.transform = `translateX(${geometry.offset}px)`;
      }
    }
  };

  // Обновляемся не чаще кадра и пишем прямо в style: setState на каждый кадр
  // скролла — это перерисовка всего поддерева React на каждое движение колеса.
  const scheduleUpdate = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  const anyDragging = () => parts.some((p) => p.dragging);

  const show = () => {
    if (isCoarse()) return;
    root.classList.add("osb--visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!anyDragging()) root.classList.remove("osb--visible");
    }, hideDelay);
  };

  const onScroll = () => {
    show();
    scheduleUpdate();
  };

  // --- Drag -----------------------------------------------------------------

  const pointerPos = (part: AxisParts, event: PointerEvent) => {
    const rect = part.track.getBoundingClientRect();
    return part.axis === "y"
      ? event.clientY - rect.top
      : event.clientX - rect.left;
  };

  const dragTo = (part: AxisParts, event: PointerEvent) => {
    const a = part.axis;
    scrollTo(
      a,
      scrollFromThumbOffset(
        pointerPos(part, event) - part.grab,
        viewportOf(a),
        contentOf(a),
        minThumb,
      ),
    );
  };

  const cleanups: (() => void)[] = [];

  for (const part of parts) {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isCoarse()) return;
      const a = part.axis;
      const geometry = computeThumb(
        viewportOf(a),
        contentOf(a),
        scrollOf(a),
        minThumb,
      );
      if (!geometry) return;

      // Захват за бегунок — тянем с той же точки; клик по треку — центрируем
      // бегунок под курсором.
      part.grab =
        event.target === part.thumb
          ? pointerPos(part, event) - geometry.offset
          : geometry.size / 2;
      part.dragging = true;
      root.classList.add("osb--dragging");
      // Захват указателя — иначе drag рвётся, стоит увести курсор с трека.
      part.track.setPointerCapture(event.pointerId);
      dragTo(part, event);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (part.dragging) dragTo(part, event);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!part.dragging) return;
      part.dragging = false;
      if (part.track.hasPointerCapture(event.pointerId)) {
        part.track.releasePointerCapture(event.pointerId);
      }
      if (!anyDragging()) root.classList.remove("osb--dragging");
      show();
    };

    part.track.addEventListener("pointerdown", onPointerDown);
    part.track.addEventListener("pointermove", onPointerMove);
    part.track.addEventListener("pointerup", onPointerUp);
    part.track.addEventListener("pointercancel", onPointerUp);

    cleanups.push(() => {
      part.track.removeEventListener("pointerdown", onPointerDown);
      part.track.removeEventListener("pointermove", onPointerMove);
      part.track.removeEventListener("pointerup", onPointerUp);
      part.track.removeEventListener("pointercancel", onPointerUp);
    });
  }

  // --- Наблюдатели ----------------------------------------------------------

  // Размер контента меняется без resize окна (догрузка карточек, раскрытие
  // аккордеона) — следим и за коробкой контейнера, и за его содержимым.
  // MutationObserver не нужен: любое изменение разметки, влияющее на прокрутку,
  // меняет и измеряемую высоту, а значит поднимет ResizeObserver.
  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(toWindow ? document.body : (host as HTMLElement));
    if (!toWindow) {
      for (const child of Array.from((host as HTMLElement).children)) {
        resizeObserver.observe(child);
      }
    }
  }

  eventTarget.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  // Контейнер может ездить по странице вместе со своим окружением (липкая шапка,
  // раскрытый фильтр) — обёртка должна ехать следом.
  if (!toWindow) window.addEventListener("scroll", scheduleUpdate, true);

  update();

  return () => {
    resizeObserver?.disconnect();
    eventTarget.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", scheduleUpdate);
    if (!toWindow) window.removeEventListener("scroll", scheduleUpdate, true);
    for (const cleanup of cleanups) cleanup();
    clearTimeout(hideTimer);
    cancelAnimationFrame(raf);
    root.remove();
    if (!toWindow) {
      (host as HTMLElement).classList.remove("osb-host");
      if (restoreParentPosition !== null && parent) {
        parent.style.position = restoreParentPosition;
      }
    }
  };
}
