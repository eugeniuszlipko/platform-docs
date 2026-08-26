/* =============================================================================
   Overlay scrollbar — тесты геометрии и жизненного цикла.
   Канонический источник: platform-docs/methodology/overlay-scrollbar/.
   Копии в репозиториях обязаны быть побайтово равны — правь здесь, потом вендорь.

   Геометрия вынесена из DOM-части в чистые функции именно ради этих тестов:
   ошибка в клампе бегунка визуально выглядит как «полоса иногда уезжает», и
   ловить такое в браузере дороже, чем таблицей случаев здесь.
   ========================================================================== */

import { describe, expect, it } from "vitest";
import {
  attachOverlayScrollbar,
  computeThumb,
  scrollFromThumbOffset,
} from "./overlay-scrollbar";

describe("computeThumb", () => {
  it("возвращает null, когда скроллить нечего", () => {
    // Контент ровно по вьюпорту и контент короче вьюпорта — полосы быть не должно.
    expect(computeThumb(500, 500, 0)).toBeNull();
    expect(computeThumb(500, 300, 0)).toBeNull();
  });

  it("возвращает null при субпиксельном запасе прокрутки", () => {
    // 0.4px «прокрутки» — артефакт округления зума, а не настоящий скролл:
    // полоса на такое появляться не должна.
    expect(computeThumb(500, 500.4, 0)).toBeNull();
    // Ровно порог в 1px — уже настоящий скролл.
    expect(computeThumb(500, 501, 0)).not.toBeNull();
  });

  it("возвращает null на неизмеренных и мусорных размерах", () => {
    // Первый кадр до layout: всё по нулям. Делить на ноль нельзя.
    expect(computeThumb(0, 0, 0)).toBeNull();
    expect(computeThumb(0, 1000, 0)).toBeNull();
    expect(computeThumb(500, 0, 0)).toBeNull();
    expect(computeThumb(-500, 1000, 0)).toBeNull();
    expect(computeThumb(NaN, 1000, 0)).toBeNull();
    expect(computeThumb(500, NaN, 0)).toBeNull();
  });

  it("делает бегунок пропорциональным видимой доле контента", () => {
    // Видно половину → бегунок в половину трека.
    expect(computeThumb(500, 1000, 0)).toEqual({ size: 250, offset: 0 });
  });

  it("двигает бегунок от начала трека до конца вместе со скроллом", () => {
    // maxScroll = 500, travel = 500 - 250 = 250.
    expect(computeThumb(500, 1000, 250)?.offset).toBe(125);
    expect(computeThumb(500, 1000, 500)?.offset).toBe(250);
  });

  it("не даёт бегунку выродиться на очень длинном контенте", () => {
    // Пропорция дала бы 5px — вместо этого пол в minThumb.
    const geometry = computeThumb(500, 50000, 0, 40);
    expect(geometry?.size).toBe(40);
    // Внизу страницы бегунок упирается в конец трека: travel = 500 - 40.
    expect(computeThumb(500, 50000, 49500, 40)?.offset).toBe(460);
  });

  it("не даёт minThumb перерасти сам трек", () => {
    // Крошечный контейнер (30px) при minThumb 40: бегунок ровно в трек, а не
    // длиннее него — иначе travel ушёл бы в минус и бегунок уехал вверх.
    const geometry = computeThumb(30, 300, 15, 40);
    expect(geometry).toEqual({ size: 30, offset: 0 });
  });

  it("клампит позицию скролла за пределами диапазона", () => {
    // Резиновый скролл (overscroll) в Safari даёт отрицательный scrollY и
    // scrollY больше maxScroll — бегунок обязан остаться в треке.
    expect(computeThumb(500, 1000, -200)?.offset).toBe(0);
    expect(computeThumb(500, 1000, 900)?.offset).toBe(250);
  });
});

describe("scrollFromThumbOffset", () => {
  it("переводит смещение бегунка в позицию скролла", () => {
    // travel = 250, maxScroll = 500 → середина трека = середина документа.
    expect(scrollFromThumbOffset(125, 500, 1000)).toBe(250);
    expect(scrollFromThumbOffset(0, 500, 1000)).toBe(0);
    expect(scrollFromThumbOffset(250, 500, 1000)).toBe(500);
  });

  it("клампит смещение за пределами трека", () => {
    // Drag с уводом курсора выше/ниже трека — скролл упирается в границы,
    // а не улетает за них.
    expect(scrollFromThumbOffset(-500, 500, 1000)).toBe(0);
    expect(scrollFromThumbOffset(9999, 500, 1000)).toBe(500);
  });

  it("возвращает 0, когда скроллить нечего", () => {
    expect(scrollFromThumbOffset(100, 500, 500)).toBe(0);
    expect(scrollFromThumbOffset(100, 0, 0)).toBe(0);
  });

  it("возвращает 0, когда бегунок занял весь трек", () => {
    // size === viewport → travel === 0, делить не на что.
    expect(scrollFromThumbOffset(10, 30, 300, 40)).toBe(0);
  });

  it("обратен computeThumb", () => {
    // Круговой прогон: скролл → смещение бегунка → скролл.
    for (const scroll of [0, 137, 499, 500]) {
      const geometry = computeThumb(500, 1000, scroll);
      expect(geometry).not.toBeNull();
      expect(scrollFromThumbOffset(geometry!.offset, 500, 1000)).toBeCloseTo(
        scroll,
        5,
      );
    }
  });
});

describe("attachOverlayScrollbar", () => {
  it("ставит свой DOM рядом с контейнером и убирает его при отписке", () => {
    const parent = document.createElement("div");
    const host = document.createElement("div");
    parent.appendChild(host);
    document.body.appendChild(parent);

    const detach = attachOverlayScrollbar(host);

    // Полоса — сестра контейнера, а не его потомок: внутри она уехала бы
    // вместе с содержимым при прокрутке.
    const root = parent.querySelector(".osb");
    expect(root).not.toBeNull();
    expect(root?.parentElement).toBe(parent);
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    // Нативную полосу контейнера прячет класс-маркер (CSS модуля).
    expect(host.classList.contains("osb-host")).toBe(true);
    // Статичному родителю выставлен position — иначе полоса отсчиталась бы
    // от произвольного предка выше по дереву.
    expect(parent.style.position).toBe("relative");

    detach();

    expect(parent.querySelector(".osb")).toBeNull();
    expect(host.classList.contains("osb-host")).toBe(false);
    expect(parent.style.position).toBe("");

    parent.remove();
  });

  it("прячет полосу, пока контейнер не скроллится", () => {
    // В jsdom все размеры нулевые — это и есть случай «мерить нечего».
    const parent = document.createElement("div");
    const host = document.createElement("div");
    parent.appendChild(host);
    document.body.appendChild(parent);

    const detach = attachOverlayScrollbar(host);
    expect(
      parent.querySelector(".osb-track")?.classList.contains(
        "osb-track--disabled",
      ),
    ).toBe(true);

    detach();
    parent.remove();
  });

  it("создаёт трек на каждую запрошенную ось", () => {
    const parent = document.createElement("div");
    const host = document.createElement("div");
    parent.appendChild(host);
    document.body.appendChild(parent);

    const detach = attachOverlayScrollbar(host, { axis: "both" });
    expect(parent.querySelectorAll(".osb-track")).toHaveLength(2);
    expect(parent.querySelector(".osb-track--y")).not.toBeNull();
    expect(parent.querySelector(".osb-track--x")).not.toBeNull();

    detach();
    parent.remove();
  });

  it("для окна кладёт фиксированный трек в body", () => {
    const detach = attachOverlayScrollbar(window);

    const root = document.body.querySelector(".osb");
    expect(root?.classList.contains("osb--fixed")).toBe(true);
    expect(root?.parentElement).toBe(document.body);

    detach();
    expect(document.body.querySelector(".osb")).toBeNull();
  });
});
