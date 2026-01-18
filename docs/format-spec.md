# Спецификация формата сценариев (YAML Front Matter + Ink)

## Общий формат файла

Файл состоит из двух частей:
1. YAML front matter (метаданные)
2. Ink-сценарий (диалоги)

```
---
[YAML метаданные]
---

[Ink код]
```

## YAML Front Matter

### Обязательные поля

#### dialog (object)
```yaml
dialog:
  id: "intro_001"           # Уникальный ID (латиница, цифры, _, -)
  title: "Название"         # Отображаемое название
  participants: ["npc", "player"]  # Ровно 2 участника
```

#### characters (object)
```yaml
characters:
  npc:
    name: "Алекс"           # Отображаемое имя
    color: "#4A90E2"        # Цвет имени (hex)
    avatar: "https://..."   # URL аватара
  player:
    name: "Вы"
    color: "#7ED321"
    avatar: "https://..."
```

### Опциональные поля

#### ui (object)
```yaml
ui:
  typing:
    minDelayMs: 200         # Минимальная задержка (мс)
    maxDelayMs: 1200        # Максимальная задержка (мс)
  allowRestart: true        # Разрешить перезапуск
```

## Ink-сценарий

### Переменные
```ink
VAR speaker = ""
```

### Установка говорящего
```ink
~ speaker = "npc"
Текст сообщения от NPC.

~ speaker = "player"
Текст ответа игрока.
```

### Узлы (knots)
```ink
=== start ===
Начальный узел (обязателен)

=== another_knot ===
Другой узел
```

### Выборы (choices)
```ink
+ [Текст варианта 1]
    -> target_knot
+ [Текст варианта 2]
    -> another_knot
```

### Переходы (diverts)
```ink
-> next_knot
-> END
```

## Ограничения

- Ровно 2 персонажа
- Каждая реплика должна иметь явно заданного speaker
- Все ветки должны завершаться `-> END`
- Запрещены комментарии в файле
- Все узлы должны быть достижимы из `start`

## Полный пример

```
---
dialog:
  id: "intro_001"
  title: "Встреча"
  participants: ["npc", "player"]

characters:
  npc:
    name: "Алекс"
    color: "#4A90E2"
    avatar: "https://example.com/alex.png"
  player:
    name: "Сергей"
    color: "#7ED321"
    avatar: "https://example.com/sergey.png"

ui:
  typing:
    minDelayMs: 200
    maxDelayMs: 1200
  allowRestart: true
---

VAR speaker = ""

=== start ===
~ speaker = "npc"
Привет. Ты здесь впервые?

+ [Да]
    -> yes_path
+ [Нет]
    -> no_path

=== yes_path ===
~ speaker = "player"
Да.

~ speaker = "npc"
Тогда начнём с простого.

-> END

=== no_path ===
~ speaker = "player"
Нет.

~ speaker = "npc"
Значит, ты знаешь правила.

-> END
```
