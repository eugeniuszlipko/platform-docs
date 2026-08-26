# Overlay scrollbar — общий модуль

> Last updated: 2026-08-26 | Канонический источник кода — эта папка

Единая оверлейная полоса прокрутки для всех проектов воркспейса. Нативный скролл
остаётся нативным (колесо, клавиатура, тач, скролл-якоря), нативная **полоса**
скрыта через CSS, а поверх контента рисуется своя — она не занимает ширину
вьюпорта, поэтому страница со скроллом и без него имеют одинаковую ширину
контента, а справа нет вечного пустого жёлоба.

## Состав

| Файл | Что это |
|---|---|
| `overlay-scrollbar.ts` | Vanilla-ядро, без React. `attachOverlayScrollbar(target, options) => detach`, плюс чистые `computeThumb` / `scrollFromThumbOffset` |
| `OverlayScrollbar.tsx` | React-обёртки: компонент полосы страницы и хук `useOverlayScrollbar` для внутренних контейнеров |
| `overlay-scrollbar.css` | Стили целиком на токенах, своих цветов и размеров не содержат |
| `overlay-scrollbar.test.ts` | Юнит-тесты геометрии и жизненного цикла |

## Вендоринг

Проекты — отдельные git-репозитории со своими `node_modules`; монорепы и общего
npm-пакета нет. Поэтому файлы **копируются** в каждый репо и обязаны быть
побайтово одинаковыми. Правки вносятся здесь, затем разносятся:

```bash
SRC=platform-docs/methodology/overlay-scrollbar
for P in avocado.kiss/components cozycorner/components web.admin/src/components; do
  cp "$SRC"/overlay-scrollbar.{ts,css} "$SRC"/OverlayScrollbar.tsx "$SRC"/overlay-scrollbar.test.ts "$P/overlay-scrollbar/"
done
```

Проверка расхождений (должен быть один хеш на файл):

```bash
md5 -q {platform-docs/methodology,{avocado.kiss,cozycorner}/components,web.admin/src/components}/overlay-scrollbar/overlay-scrollbar.ts | sort -u
```

## Где подключено

| Проект | Полоса страницы | Внутренние контейнеры |
|---|---|---|
| `avocado.kiss` | `app/layout.tsx` | `SearchBox` (мобильный оверлей), `MobileMenu` |
| `cozycorner` | `app/layout.tsx` | `SearchBox` (мобильный оверлей) |
| `web.admin` | `components/AppShell.tsx` | `dialog.tsx` (`DialogBody`), `dropdown-menu.tsx`, `command.tsx`, `table.tsx` (ось X) |

## Токены

Модуль читает только эти переменные; значения задаёт глобальный CSS проекта.

```
--osb-width        ширина трека (высота — у горизонтального)
--osb-inset        отступ бегунка от краёв трека
--osb-radius       скругление бегунка
--osb-thumb        цвет бегунка в покое
--osb-thumb-hover  цвет под курсором и во время drag
--osb-z            z-index полосы
```

| Проект | width | thumb / hover | z |
|---|---|---|---|
| `cozycorner` | 12px | `rgba(22,24,29,.25)` / `.45` (значения прежнего прототипа) | 200 |
| `avocado.kiss` | 10px | `rgba(11,28,44,.22)` / `.40` (от `--foreground`, под тёплый фон) | 200 |
| `web.admin` | 10px | `var(--border)` / `var(--muted-foreground)` | 40 |

В `web.admin` токены объявлены **и в `:root`, и в `.dark`**: `var()`
подставляется на том элементе, где стоит объявление, поэтому один блок в `:root`
заморозил бы светлые цвета для всей тёмной темы.

`--osb-z` подбирается под слои проекта: полоса должна быть выше липкой шапки, но
ниже полноэкранных оверлеев и модалок — иначе при открытом диалоге она ляжет
поверх затемнения.

## Скрытие нативной полосы

В глобальном CSS каждого проекта:

```css
html { scrollbar-width: none; }                        /* Firefox 64+ */
html::-webkit-scrollbar { display: none; width: 0; }   /* Chrome / Safari / Edge */
```

Внутренним контейнерам тот же эффект даёт класс `.osb-host` — его вешает и
снимает само ядро, руками ставить не нужно.

## API

```ts
// Ядро: окно или любой элемент с overflow: auto/scroll.
const detach = attachOverlayScrollbar(target, { axis: "y" | "x" | "both", hideDelay, minThumb })

// React: полоса страницы.
<OverlayScrollbar />

// React: внутренний контейнер. Возвращает callback-ref.
const listRef = useOverlayScrollbar<HTMLDivElement>()
return <div ref={listRef} className="overflow-y-auto">…</div>
```

Хук отдаёт **callback-ref**, а не принимает готовый `useRef`, и это
принципиально: объектный ref своё наполнение не сигналит, поэтому эффект
отработал бы один раз на монтировании обёртки, когда контейнера в DOM ещё нет.
Ровно так устроены порталы Radix (`<DropdownMenuContent>` смонтирован всегда, а
его Content появляется только при открытии) — с объектным ref полоса там не
подключалась бы вовсе.

## Что стоит знать при правках

- **Тач.** При `(pointer: coarse)` трек скрыт через CSS, и ядро не считает
  геометрию. Нативные полосы там уже оверлейные, своя только перехватывала бы
  тапы у края экрана.
- **Позиционирование для элемента.** Обёртка кладётся **рядом** с контейнером, в
  его родителя (внутри она уехала бы вместе с контентом), и родителю выставляется
  `position: relative`, если он статичный. Благодаря этому `offsetParent`
  контейнера — гарантированно этот родитель, и коробка считается через
  `offsetTop/offsetLeft` без возни с `getBoundingClientRect`.
- **Никакого `setState` в цикле анимации.** Позиция пишется прямо в `style`, класс
  видимости — через `classList`. `setState` на каждый кадр скролла перерисовывал
  бы поддерево React на каждое движение колеса.
- **`ResizeObserver`, не `MutationObserver`.** Любое изменение разметки, влияющее
  на прокрутку, меняет и измеряемый размер, а значит поднимет `ResizeObserver`.
- **Определение окна — по `nodeType`, не через `instanceof Window`.** Последний
  врёт, когда объект пришёл из другого реалма: так ведёт себя `window` в jsdom
  под Vitest и внутри iframe.
- **Radix Select трогать не нужно.** Там скроллится Viewport, а не Content, и
  Radix прячет его полосу собственным стилем, заменяя её кнопками прокрутки.
- **Radix + модалки.** Со скрытой нативной полосой `react-remove-scroll` меряет
  её ширину как 0, и компенсирующий `padding-right` на body становится no-op —
  открытие модалки перестаёт сдвигать контент. Поэтому `scrollbar-gutter: stable`
  несовместим с модулем: он вернул бы жёлоб и сдвиг.
