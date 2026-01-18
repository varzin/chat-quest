---
dialog:
  id: "demo_meeting"
  title: "Таинственный незнакомец"
  participants: ["stranger", "player"]

characters:
  stranger:
    name: "Незнакомец"
    color: "#4A90E2"
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=stranger&backgroundColor=1c1c1e"
  player:
    name: "Вы"
    color: "#7ED321"
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=player&backgroundColor=1c1c1e"

ui:
  typing:
    minDelayMs: 400
    maxDelayMs: 1800
  allowRestart: true
---

VAR speaker = ""

=== start ===
~ speaker = "stranger"
Привет, путник.

Я заметил тебя издалека. Ты выглядишь потерянным.

+ [Кто вы?]
    -> who_are_you
+ [Мне нужна помощь]
    -> need_help
+ [Я просто гуляю]
    -> just_walking

=== who_are_you ===
~ speaker = "player"
Кто вы такой?

~ speaker = "stranger"
Меня зовут по-разному. Странник. Хранитель перекрёстков. Или просто... друг.

Это зависит от того, что тебе нужно.

+ [Мне нужен совет]
    -> advice_path
+ [Мне ничего не нужно]
    -> nothing_needed

=== need_help ===
~ speaker = "player"
Мне нужна помощь.

~ speaker = "stranger"
Тогда ты пришёл по адресу.

Что тебя беспокоит?

+ [Я заблудился]
    -> lost_path
+ [Я ищу что-то важное]
    -> searching_path

=== just_walking ===
~ speaker = "player"
Я просто гуляю. Наслаждаюсь тишиной.

~ speaker = "stranger"
Хороший ответ. Немногие ценят тишину в наши дни.

Тогда не буду тебя задерживать. Приятной прогулки.

~ speaker = "player"
Спасибо. И вам хорошего дня.

-> END

=== advice_path ===
~ speaker = "player"
Мне нужен совет.

~ speaker = "stranger"
Совет... Хорошо.

Вот что я скажу: не бойся сворачивать с протоптанных дорог. Иногда лучшие открытия ждут там, где никто не ходит.

~ speaker = "player"
Я запомню это. Спасибо.

~ speaker = "stranger"
Удачи тебе, путник.

-> END

=== nothing_needed ===
~ speaker = "player"
Мне ничего не нужно. Я справлюсь сам.

~ speaker = "stranger"
Независимость — хорошее качество. Но помни: просить помощи — не слабость.

До встречи, путник.

-> END

=== lost_path ===
~ speaker = "player"
Я заблудился. Не знаю, куда идти.

~ speaker = "stranger"
Заблудиться — первый шаг к тому, чтобы найти себя.

Видишь ту тропу на востоке? Она приведёт тебя к деревне. Там ты найдёшь еду и ночлег.

~ speaker = "player"
Спасибо! Я пойду туда.

~ speaker = "stranger"
Береги себя.

-> END

=== searching_path ===
~ speaker = "player"
Я ищу что-то важное. Но не могу понять, что именно.

~ speaker = "stranger"
Многие ищут, не зная что. Это называется путешествием.

Может быть, ты ищешь не вещь, а ответ? Или человека?

+ [Я ищу ответы]
    -> seeking_answers
+ [Я ищу кого-то]
    -> seeking_someone

=== seeking_answers ===
~ speaker = "player"
Я ищу ответы на свои вопросы.

~ speaker = "stranger"
Тогда продолжай идти вперёд. Ответы приходят к тем, кто не останавливается.

И помни: иногда вопрос важнее ответа.

~ speaker = "player"
Я подумаю об этом. Прощайте.

~ speaker = "stranger"
До свидания, искатель.

-> END

=== seeking_someone ===
~ speaker = "player"
Я ищу кого-то. Человека, которого потерял.

~ speaker = "stranger"
Потери... Они делают нас сильнее или ломают.

Если этот человек хочет быть найденным — ты найдёшь его. Если нет... тогда, возможно, тебе нужно найти себя.

~ speaker = "player"
Вы правы. Мне нужно время, чтобы это осознать.

~ speaker = "stranger"
Время у тебя есть. Удачи в поисках.

-> END
