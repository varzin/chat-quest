'use strict';

/**
 * Chat Quest - Main Application Module
 */

import { initI18n, setLanguage, getLanguage, t, updatePageTranslations } from './i18n.js';
import * as storage from './storage.js';
import { parseScenario, generateId } from './parser.js';
import InkEngine from './engine.js';
import UIController from './ui.js';

// Demo scenario (embedded)
const DEMO_SCENARIO = `---
dialog:
  id: "demo_meeting"
  title: "Таинственный незнакомец"
  participants: ["stranger", "player"]

characters:
  stranger:
    name: "Незнакомец"
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=stranger&backgroundColor=1a1a2e"
  player:
    name: "Вы"
    avatar: "https://api.dicebear.com/7.x/personas/svg?seed=player&backgroundColor=1a1a2e"

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

+ [Кто вы такой?]
    -> who_are_you
+ [Мне нужна помощь]
    -> need_help
+ [Я просто гуляю]
    -> just_walking

=== who_are_you ===
~ speaker = "stranger"
Меня зовут по-разному. Странник. Хранитель перекрёстков. Или просто... друг.

Это зависит от того, что тебе нужно.

+ [Расскажите о себе подробнее]
    -> stranger_story
+ [Мне нужен совет]
    -> advice_path
+ [Мне ничего не нужно]
    -> nothing_needed

=== stranger_story ===
~ speaker = "stranger"
Ты хочешь знать мою историю? Что ж...

Я был таким же путником, как ты. Однажды я потерял всё — дом, семью, смысл жизни.

Долгие годы я скитался по дорогам в поисках ответов.

+ [И вы нашли их?]
    -> stranger_found_answers
+ [Это грустная история]
    -> stranger_sad

=== stranger_found_answers ===
~ speaker = "stranger"
Нашёл ли я ответы? И да, и нет.

Я понял, что ответы — это не конечная точка. Это бесконечный путь.

Каждый день приносит новые вопросы. И это прекрасно.

+ [Звучит как мудрость]
    -> wisdom_path
+ [Я не уверен, что понимаю]
    -> confused_path

=== stranger_sad ===
~ speaker = "stranger"
Грустная? Возможно.

Но в каждой потере есть зерно нового начала. Я научился видеть красоту в простых вещах.

Рассвет над горами. Шелест листьев. Улыбка незнакомца.

+ [Вы научились быть счастливым?]
    -> happiness_talk
+ [Мне тоже нужно научиться этому]
    -> learn_happiness

=== wisdom_path ===
~ speaker = "stranger"
Мудрость... Это слишком громкое слово для меня.

Я просто старый путник, который видел много дорог.

Но если мои слова помогут тебе — значит, наша встреча была не случайной.

+ [Верите в судьбу?]
    -> fate_talk
+ [Спасибо за разговор]
    -> thanks_goodbye

=== confused_path ===
~ speaker = "stranger"
Понимание придёт со временем.

Не торопись. Жизнь — это не гонка.

+ [Хороший совет]
    -> good_advice
+ [Но время не ждёт]
    -> time_waits

=== happiness_talk ===
~ speaker = "stranger"
Счастье... Это не состояние, а выбор.

Каждое утро я выбираю быть благодарным за новый день.

Это не значит, что нет трудностей. Но я научился принимать их как часть пути.

+ [Я попробую так жить]
    -> try_happiness
+ [Это сложно]
    -> hard_happiness

=== learn_happiness ===
~ speaker = "stranger"
Учиться никогда не поздно.

Начни с малого. Каждый вечер вспоминай три хорошие вещи, которые произошли за день.

Даже самые маленькие.

~ speaker = "player"
Я попробую. Спасибо за совет.

~ speaker = "stranger"
Удачи тебе, путник. Может, ещё встретимся.

-> END

=== fate_talk ===
~ speaker = "stranger"
Судьба... Интересный вопрос.

Я верю, что мы сами пишем свою историю. Но иногда кажется, что кто-то подсказывает следующую строчку.

Может, это и есть судьба — встретить нужного человека в нужный момент.

+ [Как вы и я сейчас?]
    -> fate_us
+ [Я не верю в такое]
    -> no_fate

=== fate_us ===
~ speaker = "stranger"
Именно.

Ты мог пойти другой дорогой. Я мог не остановиться здесь.

Но мы оба здесь. И этот разговор уже изменил что-то в каждом из нас.

~ speaker = "player"
Вы заставляете меня задуматься.

~ speaker = "stranger"
Это лучший комплимент для старого странника. Доброго пути!

-> END

=== no_fate ===
~ speaker = "stranger"
Твоё право. Вера — это личный выбор.

Главное — не переставай искать свой путь. С судьбой или без неё.

~ speaker = "player"
Я постараюсь. Прощайте.

~ speaker = "stranger"
До встречи, путник.

-> END

=== thanks_goodbye ===
~ speaker = "player"
Спасибо за разговор. Мне пора идти.

~ speaker = "stranger"
Иди с миром. И помни — каждый перекрёсток это новая возможность.

~ speaker = "player"
Я запомню.

-> END

=== good_advice ===
~ speaker = "player"
Действительно хороший совет. Я слишком часто тороплюсь.

~ speaker = "stranger"
Мы все торопимся. Это болезнь нашего времени.

Но ты уже сделал первый шаг — остановился и поговорил со мной.

~ speaker = "player"
Пожалуй, вы правы.

~ speaker = "stranger"
Удачи в пути, друг.

-> END

=== time_waits ===
~ speaker = "stranger"
Время... Оно течёт одинаково для всех.

Но то, как мы его используем — наш выбор.

Можно бежать и ничего не видеть. А можно идти медленно и замечать чудеса вокруг.

+ [Я попробую замедлиться]
    -> slow_down
+ [У меня нет такой роскоши]
    -> no_luxury

=== slow_down ===
~ speaker = "player"
Вы правы. Я попробую замедлиться.

~ speaker = "stranger"
Это мудрое решение.

Начни с дыхания. Когда чувствуешь, что торопишься — сделай три глубоких вдоха.

~ speaker = "player"
Простой совет, но звучит действенно.

~ speaker = "stranger"
Простые вещи обычно самые мощные. Доброго пути!

-> END

=== no_luxury ===
~ speaker = "stranger"
Понимаю. У каждого свои обстоятельства.

Но даже в самой загруженной жизни можно найти минуту для себя.

Может, это будет чашка чая утром. Или прогулка вечером.

~ speaker = "player"
Я подумаю над этим.

~ speaker = "stranger"
Это уже хорошо. Удачи тебе.

-> END

=== try_happiness ===
~ speaker = "player"
Я попробую так жить. Выбирать счастье каждый день.

~ speaker = "stranger"
Рад это слышать.

И помни — плохие дни тоже будут. Это нормально. Главное — не сдаваться.

~ speaker = "player"
Спасибо. Вы очень помогли.

~ speaker = "stranger"
Мы помогли друг другу. Этот разговор важен и для меня. Прощай, друг.

-> END

=== hard_happiness ===
~ speaker = "stranger"
Да, это сложно. Никто не говорил, что будет легко.

Но ты уже делаешь правильные шаги — задаёшь вопросы, ищешь ответы.

Многие живут всю жизнь, не задумываясь об этом.

+ [Может, им проще?]
    -> easier_ignorance
+ [Я хочу жить осознанно]
    -> conscious_living

=== easier_ignorance ===
~ speaker = "stranger"
Проще? Возможно. Но не лучше.

Незнание — это не счастье. Это просто незнание.

Настоящее счастье приходит через понимание себя и мира.

~ speaker = "player"
Тогда я на правильном пути.

~ speaker = "stranger"
Определённо. Удачи тебе, искатель.

-> END

=== conscious_living ===
~ speaker = "stranger"
Осознанная жизнь — это путь воина духа.

Каждый день — битва с привычками, страхами, сомнениями.

Но награда стоит усилий.

~ speaker = "player"
Я готов к этому пути.

~ speaker = "stranger"
Тогда иди смело. И помни — ты не один.

-> END

=== need_help ===
~ speaker = "stranger"
Тогда ты пришёл по адресу.

Что тебя беспокоит?

+ [Я заблудился, не знаю куда идти]
    -> lost_path
+ [Я ищу что-то важное]
    -> searching_path
+ [У меня проблемы]
    -> problems_path

=== problems_path ===
~ speaker = "stranger"
Проблемы... У всех они есть.

Расскажи, что случилось? Иногда просто выговориться — уже половина решения.

+ [Я потерял работу]
    -> lost_job
+ [У меня сложности в отношениях]
    -> relationship_problems
+ [Я не знаю, чего хочу от жизни]
    -> life_purpose

=== lost_job ===
~ speaker = "stranger"
Работа... Это больная тема для многих.

Но помни — работа это не ты. Ты гораздо больше, чем твоя должность.

+ [Но как жить без денег?]
    -> money_worries
+ [Может, это шанс для нового начала?]
    -> new_beginning

=== money_worries ===
~ speaker = "stranger"
Деньги важны, не спорю.

Но я видел богачей, несчастных до глубины души. И бедняков, сияющих от радости.

Сейчас важно не паниковать. Составь план. Оцени свои навыки.

~ speaker = "player"
Вы правы. Паника только мешает.

~ speaker = "stranger"
Именно. Действуй спокойно и последовательно. Всё наладится.

-> END

=== new_beginning ===
~ speaker = "stranger"
Вот! Ты уже мыслишь в правильном направлении.

Каждый конец — это начало чего-то нового. Может, это шанс найти дело своей жизни?

~ speaker = "player"
Я никогда не думал об этом так.

~ speaker = "stranger"
Теперь подумай. И пусть эта потеря станет твоим трамплином к лучшей жизни.

-> END

=== relationship_problems ===
~ speaker = "stranger"
Отношения... Самая сложная область человеческой жизни.

Что именно происходит?

+ [Мы постоянно ссоримся]
    -> constant_fights
+ [Мы отдалились друг от друга]
    -> growing_apart

=== constant_fights ===
~ speaker = "stranger"
Ссоры — это часть любых отношений.

Вопрос в том, как вы ссоритесь. Вы слушаете друг друга? Или только кричите?

~ speaker = "player"
Честно говоря, мы больше кричим.

~ speaker = "stranger"
Тогда начни с себя. В следующей ссоре — остановись и послушай.

Не чтобы ответить, а чтобы понять.

~ speaker = "player"
Я попробую.

~ speaker = "stranger"
Это всё, что нужно. Маленькие шаги ведут к большим переменам.

-> END

=== growing_apart ===
~ speaker = "stranger"
Отдаление... Это происходит постепенно, незаметно.

Когда вы последний раз проводили время вместе? Без телефонов, без отвлечений?

~ speaker = "player"
Я даже не помню.

~ speaker = "stranger"
Вот с этого и начни. Предложи провести вечер вдвоём.

Поговорите. Вспомните, что вас связывает.

~ speaker = "player"
Хороший совет. Спасибо.

~ speaker = "stranger"
Любовь требует работы. Но она того стоит.

-> END

=== life_purpose ===
~ speaker = "stranger"
Смысл жизни... Великий вопрос.

Я скажу тебе секрет — универсального ответа нет.

Каждый находит свой смысл. И он может меняться со временем.

+ [Как найти свой смысл?]
    -> find_purpose
+ [Это пугает меня]
    -> purpose_fear

=== find_purpose ===
~ speaker = "stranger"
Как найти? Экспериментируй.

Пробуй новое. Замечай, что приносит радость, а что — пустоту.

Смысл не находят. Его создают.

~ speaker = "player"
Создают?

~ speaker = "stranger"
Да. Каждым действием, каждым выбором ты создаёшь свою историю.

Сделай её историей, которой будешь гордиться.

~ speaker = "player"
Это вдохновляет. Спасибо.

~ speaker = "stranger"
Иди и создавай, творец. Мир ждёт твоей истории.

-> END

=== purpose_fear ===
~ speaker = "stranger"
Страх — это нормально.

Неизвестность пугает всех. Но за страхом часто скрываются лучшие возможности.

+ [Как преодолеть страх?]
    -> overcome_fear
+ [Я не уверен, что смогу]
    -> not_sure

=== overcome_fear ===
~ speaker = "stranger"
Страх не нужно преодолевать. С ним нужно подружиться.

Признай его. Скажи: "Да, мне страшно. И я всё равно иду вперёд."

Это и есть настоящая храбрость.

~ speaker = "player"
Мне страшно. Но я попробую.

~ speaker = "stranger"
Ты уже храбрее, чем думаешь. Удачи, воин.

-> END

=== not_sure ===
~ speaker = "stranger"
Никто не уверен. Это секрет, который знают все успешные люди.

Они просто действуют, несмотря на неуверенность.

~ speaker = "player"
Но что если я ошибусь?

~ speaker = "stranger"
Ошибёшься — и научишься. Ошибки это не провал. Это уроки.

~ speaker = "player"
Я постараюсь помнить это.

~ speaker = "stranger"
Помни. И действуй. Удачи тебе.

-> END

=== just_walking ===
~ speaker = "stranger"
Хороший ответ. Немногие ценят тишину в наши дни.

Но я вижу в твоих глазах что-то ещё. Уверен, что просто гуляешь?

+ [Ладно, вы правы. Мне нужно поговорить]
    -> need_to_talk
+ [Да, просто наслаждаюсь природой]
    -> enjoy_nature

=== need_to_talk ===
~ speaker = "stranger"
Я так и думал. Говори, я слушаю.

У меня много времени и ещё больше терпения.

+ [Я чувствую себя одиноким]
    -> feeling_lonely
+ [Я на распутье]
    -> crossroads

=== feeling_lonely ===
~ speaker = "stranger"
Одиночество... Странная штука.

Можно быть одиноким в толпе. И чувствовать связь, сидя в пустой комнате.

+ [Как это понять?]
    -> understand_loneliness
+ [Я хочу найти своих людей]
    -> find_people

=== understand_loneliness ===
~ speaker = "stranger"
Одиночество — это не отсутствие людей.

Это отсутствие связи. Настоящей, глубокой связи.

Может, ты окружён людьми, но никто не видит настоящего тебя?

~ speaker = "player"
Точно... Именно так я и чувствую.

~ speaker = "stranger"
Тогда начни показывать себя настоящего. Это страшно, но это единственный путь к настоящей близости.

~ speaker = "player"
Я попробую быть более открытым.

~ speaker = "stranger"
Это мужественный выбор. Удачи тебе.

-> END

=== find_people ===
~ speaker = "stranger"
Свои люди... Они есть у каждого.

Ищи места, где собираются люди с похожими интересами.

Клубы, группы, сообщества. Не бойся быть первым, кто начнёт разговор.

~ speaker = "player"
Мне сложно знакомиться.

~ speaker = "stranger"
Всем сложно. Но это как мышца — чем больше тренируешь, тем легче становится.

Начни с малого. Улыбнись незнакомцу. Скажи "привет" соседу.

~ speaker = "player"
Хорошо, я попробую.

~ speaker = "stranger"
Молодец. Твои люди уже ищут тебя. Помоги им найти тебя.

-> END

=== crossroads ===
~ speaker = "stranger"
Распутье... Я хорошо знаю это чувство.

Какие дороги перед тобой?

+ [Оставить всё и уехать куда-то далеко]
    -> leave_everything
+ [Изменить карьеру полностью]
    -> change_career

=== leave_everything ===
~ speaker = "stranger"
Уехать... Романтичная идея.

Но скажи честно — ты бежишь К чему-то или ОТ чего-то?

~ speaker = "player"
Хороший вопрос... Наверное, от чего-то.

~ speaker = "stranger"
Тогда подумай ещё раз.

Куда бы ты ни уехал, ты берёшь с собой себя. Со всеми проблемами.

Иногда нужно сначала разобраться с собой, а потом уже менять место.

~ speaker = "player"
Вы правы. Бегство — не решение.

~ speaker = "stranger"
Но если однажды ты захочешь уехать К чему-то — вперёд. Это будет правильное путешествие.

-> END

=== change_career ===
~ speaker = "stranger"
Смена карьеры — серьёзный шаг.

Что тебя привлекает в новой профессии?

~ speaker = "player"
Я хочу делать что-то, что имеет смысл.

~ speaker = "stranger"
Похвально.

Но помни — смысл можно найти в любой работе. Дело не в профессии, а в отношении.

+ [И всё же я хочу попробовать что-то новое]
    -> try_something_new
+ [Может, мне просто нужно изменить подход?]
    -> change_approach

=== try_something_new ===
~ speaker = "stranger"
Тогда действуй!

Жизнь слишком коротка для "а что если".

Составь план. Изучи новую область. Найди ментора.

И прыгай. Сеть появится.

~ speaker = "player"
Спасибо за поддержку.

~ speaker = "stranger"
Удачи, храбрец. Мир принадлежит тем, кто рискует.

-> END

=== change_approach ===
~ speaker = "stranger"
Мудрая мысль.

Иногда не нужно менять всё. Достаточно посмотреть на привычное по-новому.

Что ты можешь изменить в своём подходе к работе уже сегодня?

~ speaker = "player"
Пожалуй, я могу быть более внимательным к деталям. И помогать коллегам.

~ speaker = "stranger"
Отличное начало. Маленькие изменения ведут к большим переменам.

~ speaker = "player"
Спасибо за разговор. Вы помогли мне разобраться.

~ speaker = "stranger"
Ты сам разобрался. Я просто задавал вопросы. Удачи!

-> END

=== enjoy_nature ===
~ speaker = "stranger"
Прекрасно. Природа — лучший целитель.

Я сам провожу много времени среди деревьев и рек.

Они учат терпению и принятию.

~ speaker = "player"
Я чувствую себя здесь спокойнее.

~ speaker = "stranger"
Это хороший знак. Слушай это чувство.

Может, тебе нужно больше времени на природе?

~ speaker = "player"
Пожалуй, да.

~ speaker = "stranger"
Тогда сделай это приоритетом. Твоя душа тебе спасибо скажет.

Приятной прогулки, друг природы.

-> END

=== advice_path ===
~ speaker = "stranger"
Совет... Хорошо.

О чём ты хочешь узнать мнение старого странника?

+ [О жизни в целом]
    -> life_advice
+ [О любви]
    -> love_advice
+ [О работе и успехе]
    -> success_advice

=== life_advice ===
~ speaker = "stranger"
Жизнь... Большая тема.

Вот что я понял за долгие годы:

Жизнь — это не гонка. Это танец.

+ [Что вы имеете в виду?]
    -> dance_meaning
+ [Красиво сказано]
    -> beautiful_words

=== dance_meaning ===
~ speaker = "stranger"
В гонке важно прийти первым. В танце — наслаждаться процессом.

Мы так часто торопимся к финишу, что забываем жить.

Замедлись. Почувствуй музыку жизни. И танцуй свой танец.

~ speaker = "player"
Я попробую танцевать.

~ speaker = "stranger"
И не бойся выглядеть глупо. Лучшие танцоры сначала спотыкаются.

-> END

=== beautiful_words ===
~ speaker = "stranger"
Слова легко сказать. Труднее — жить по ним.

Но я стараюсь. Каждый день.

~ speaker = "player"
Как вам это удаётся?

~ speaker = "stranger"
Напоминаю себе каждое утро. И прощаю себя, когда забываю.

Жизнь это практика, не совершенство.

~ speaker = "player"
Спасибо. Я буду помнить.

~ speaker = "stranger"
Помни и практикуй. Удачи, танцор.

-> END

=== love_advice ===
~ speaker = "stranger"
Любовь... Самая загадочная сила во вселенной.

Что ты хочешь узнать о ней?

+ [Как найти настоящую любовь?]
    -> find_true_love
+ [Как сохранить любовь?]
    -> keep_love

=== find_true_love ===
~ speaker = "stranger"
Настоящая любовь не находится. Она происходит.

Когда ты перестаёшь искать и начинаешь жить — она появляется.

~ speaker = "player"
Но как жить, не ища?

~ speaker = "stranger"
Стань человеком, которого ты хочешь встретить.

Развивайся. Живи интересно. Будь открыт миру.

И однажды ты просто посмотришь в чьи-то глаза и поймёшь — вот оно.

~ speaker = "player"
Звучит как магия.

~ speaker = "stranger"
Любовь и есть магия. Единственная настоящая магия в этом мире.

-> END

=== keep_love ===
~ speaker = "stranger"
Сохранить любовь сложнее, чем найти.

Секрет в том, чтобы влюбляться снова и снова. В того же человека.

~ speaker = "player"
Как это?

~ speaker = "stranger"
Замечай. Каждый день находи что-то новое в своём партнёре.

Удивляй и позволяй удивлять себя.

Не воспринимай любовь как должное.

~ speaker = "player"
Я понимаю. Работа над отношениями.

~ speaker = "stranger"
Не работа. Танец. Вечный танец двоих.

-> END

=== success_advice ===
~ speaker = "stranger"
Успех... Что это значит для тебя?

+ [Деньги и признание]
    -> money_success
+ [Счастье и удовлетворение]
    -> happiness_success

=== money_success ===
~ speaker = "stranger"
Деньги и признание... Многие к этому стремятся.

Но я видел богатых людей, плачущих по ночам. И знаменитых, умоляющих о покое.

~ speaker = "player"
Тогда в чём смысл?

~ speaker = "stranger"
Деньги — инструмент, не цель.

Заработай столько, чтобы не думать о них. И потрать на то, что важно.

Признание — эхо. Оно исчезает.

Оставь после себя что-то настоящее — и эхо будет звучать вечно.

~ speaker = "player"
Вы изменили мой взгляд на успех.

~ speaker = "stranger"
Это и была моя цель. Удачи, искатель настоящего успеха.

-> END

=== happiness_success ===
~ speaker = "stranger"
Счастье как цель... Это мудрый выбор.

Но счастье — не постоянное состояние. Это моменты.

Секрет в том, чтобы замечать эти моменты и ценить их.

~ speaker = "player"
Как научиться замечать?

~ speaker = "stranger"
Практика осознанности. Каждый день останавливайся и спрашивай:

Что я чувствую прямо сейчас?

За что я благодарен?

Что принесло мне радость сегодня?

~ speaker = "player"
Простые вопросы.

~ speaker = "stranger"
Простые вопросы с глубокими ответами. Удачи на пути к счастью.

-> END

=== nothing_needed ===
~ speaker = "stranger"
Независимость — хорошее качество.

Но иногда даже самые сильные нуждаются в опоре.

~ speaker = "player"
Я справляюсь.

~ speaker = "stranger"
Верю. И всё же — если когда-нибудь понадобится разговор, я часто бываю на этом перекрёстке.

~ speaker = "player"
Спасибо. Я запомню.

~ speaker = "stranger"
До встречи, путник. Пусть дорога будет лёгкой.

-> END

=== lost_path ===
~ speaker = "stranger"
Заблудиться — первый шаг к тому, чтобы найти себя.

Куда ты шёл изначально?

+ [В город, искать работу]
    -> to_city
+ [Домой, к семье]
    -> to_home
+ [Сам не знаю]
    -> dont_know_where

=== to_city ===
~ speaker = "stranger"
Город... Большие возможности и большие опасности.

Видишь ту тропу на востоке? Она приведёт тебя к тракту. Через день пути — городские врата.

~ speaker = "player"
Спасибо!

~ speaker = "stranger"
Подожди. Возьми совет бесплатно.

В городе — не доверяй первому встречному. Но и не закрывайся от всех.

Найди золотую середину.

~ speaker = "player"
Я постараюсь. Прощайте.

~ speaker = "stranger"
Удачи в городе, искатель возможностей.

-> END

=== to_home ===
~ speaker = "stranger"
Домой... Это хорошая цель.

Семья ждёт тебя?

~ speaker = "player"
Надеюсь, что да.

~ speaker = "stranger"
Видишь тропу на западе? Она ведёт к деревням.

Спрашивай местных — они покажут дорогу.

И когда вернёшься — обними своих. Крепко. Время летит быстро.

~ speaker = "player"
Я обниму. Спасибо за направление.

~ speaker = "stranger"
Иди с миром. Дом ближе, чем кажется.

-> END

=== dont_know_where ===
~ speaker = "stranger"
Не знаешь... Интересно.

Может, это знак? Может, тебе и не нужно никуда идти?

+ [Что вы имеете в виду?]
    -> stay_meaning
+ [Мне нужна цель]
    -> need_goal

=== stay_meaning ===
~ speaker = "stranger"
Иногда лучший путь — остаться.

Посиди здесь. Посмотри на небо. Послушай ветер.

Может, ответ придёт сам.

~ speaker = "player"
Я слишком привык бежать.

~ speaker = "stranger"
Знаю. Мы все привыкли.

Но иногда чтобы найти путь — нужно остановиться.

~ speaker = "player"
Я попробую.

~ speaker = "stranger"
Я посижу с тобой немного. В тишине. Вместе.

-> END

=== need_goal ===
~ speaker = "stranger"
Цель... Её можно создать прямо сейчас.

Куда тебя тянет? К морю? В горы? К людям или от них?

~ speaker = "player"
К морю, наверное. Я никогда его не видел.

~ speaker = "stranger"
Тогда вот твоя цель!

Иди на юг. Через неделю увидишь его — бескрайнее, синее, вечное.

~ speaker = "player"
Море... Да, это то, что мне нужно.

~ speaker = "stranger"
Иди. И когда увидишь волны — вспомни этот разговор.

-> END

=== searching_path ===
~ speaker = "stranger"
Многие ищут, не зная что. Это называется путешествием.

Может быть, ты ищешь не вещь, а ответ? Или человека?

+ [Я ищу ответы на свои вопросы]
    -> seeking_answers
+ [Я ищу кого-то, кого потерял]
    -> seeking_someone
+ [Я ищу себя]
    -> seeking_self

=== seeking_self ===
~ speaker = "stranger"
Себя... Самый сложный поиск.

Потому что ты — это не одно. Ты — это множество.

Ты меняешься каждую секунду.

~ speaker = "player"
Как же тогда найти себя?

~ speaker = "stranger"
Не искать. Создавать.

Каждым выбором, каждым действием ты создаёшь себя.

Вопрос не "кто я?" — а "кем я хочу быть?"

~ speaker = "player"
Это меняет всё.

~ speaker = "stranger"
Именно. Иди и создавай себя, творец.

-> END

=== seeking_answers ===
~ speaker = "stranger"
Ответы на какие вопросы?

+ [О смысле жизни]
    -> meaning_questions
+ [О моём прошлом]
    -> past_questions

=== meaning_questions ===
~ speaker = "stranger"
Смысл жизни... Философы ищут его тысячи лет.

Хочешь знать, что я нашёл?

~ speaker = "player"
Конечно.

~ speaker = "stranger"
Смысл не в том, чтобы понять жизнь. А в том, чтобы прожить её.

Полностью. Глубоко. Честно.

Это и есть ответ.

~ speaker = "player"
Проще сказать, чем сделать.

~ speaker = "stranger"
Верно. Но ты уже начал — задавая вопросы.

Продолжай. Ответы найдут тебя.

-> END

=== past_questions ===
~ speaker = "stranger"
Прошлое... Оно формирует нас, но не определяет.

Что ты хочешь узнать о своём прошлом?

~ speaker = "player"
Почему всё сложилось именно так.

~ speaker = "stranger"
На этот вопрос нет ответа.

Есть только выбор — смотреть назад и жалеть, или смотреть вперёд и строить.

~ speaker = "player"
Вы правы. Прошлое не изменить.

~ speaker = "stranger"
Но можно изменить то, что оно значит.

Каждая рана может стать учителем. Каждая ошибка — ступенькой.

Выбор за тобой.

~ speaker = "player"
Я выбираю идти вперёд.

~ speaker = "stranger"
Мудрый выбор. Удачи, строитель будущего.

-> END

=== seeking_someone ===
~ speaker = "stranger"
Потери... Они делают нас сильнее или ломают.

Кого ты ищешь?

+ [Друга, которого давно не видел]
    -> lost_friend
+ [Члена семьи]
    -> lost_family

=== lost_friend ===
~ speaker = "stranger"
Друга... Старая дружба — редкое сокровище.

Давно вы расстались?

~ speaker = "player"
Много лет назад. Мы просто... потеряли связь.

~ speaker = "stranger"
Это случается. Жизнь разводит людей.

Но если дружба была настоящей — она выдержит время.

Найди его. Напиши. Позвони. Не жди идеального момента.

~ speaker = "player"
А если он не захочет говорить?

~ speaker = "stranger"
Тогда ты будешь знать. И сможешь отпустить.

Но обычно люди рады, когда о них помнят.

~ speaker = "player"
Я свяжусь с ним.

~ speaker = "stranger"
Удачи. Пусть ваша дружба возродится.

-> END

=== lost_family ===
~ speaker = "stranger"
Семья... Это священно.

Что случилось?

~ speaker = "player"
Мы поссорились. Давно. С тех пор не разговариваем.

~ speaker = "stranger"
Ссоры в семье — самые болезненные.

Но знаешь что? Жизнь коротка. Слишком коротка для обид.

~ speaker = "player"
Я не уверен, что меня простят.

~ speaker = "stranger"
Прощение — это процесс. Начни его.

Напиши письмо. Не требуй ответа. Просто скажи, что любишь и жалеешь о ссоре.

Дальше — не в твоих руках.

~ speaker = "player"
Вы правы. Я должен попытаться.

~ speaker = "stranger"
Должен. Иди с миром. И пусть семья воссоединится.

-> END
`;

class ChatQuestApp {
    constructor() {
        this.ui = new UIController();
        this.engine = null;
        this.currentScenarioId = null;
        this.isPlaying = false;

        this._init();
    }

    /**
     * Инициализация приложения
     */
    async _init() {
        // Загружаем настройки
        const settings = storage.getSettings();
        initI18n(settings.language);

        // Настраиваем UI callbacks
        this._setupCallbacks();

        // Загружаем демо-сценарий если нет сценариев
        await this._ensureDemoScenario();

        // Обновляем список сценариев
        this._refreshScenarioList();

        // Загружаем последний сценарий или показываем пустое состояние
        const currentId = storage.getCurrentScenarioId();
        if (currentId) {
            this._loadScenario(currentId);
        } else {
            const scenarios = storage.getScenarioList();
            if (scenarios.length > 0) {
                this._loadScenario(scenarios[0].id);
            } else {
                this.ui.showEmptyState();
            }
        }

        // Устанавливаем язык в селекте настроек
        this.ui.setLanguage(getLanguage());
    }

    /**
     * Настраивает callbacks для UI
     */
    _setupCallbacks() {
        this.ui.on('onScenarioSelect', (id) => this._loadScenario(id));

        this.ui.on('onScenarioEdit', (id) => {
            const source = storage.getScenarioSource(id);
            if (source) {
                this._editingScenarioId = id;
                this.ui.openEditor(source, false);
            }
        });

        this.ui.on('onScenarioDelete', async (id, title) => {
            const confirmed = await this.ui.confirm(
                t('confirm'),
                t('confirmDelete', { title })
            );
            if (confirmed) {
                storage.deleteScenario(id);
                this._refreshScenarioList();

                // Если удалили текущий, загружаем другой
                if (this.currentScenarioId === id) {
                    const scenarios = storage.getScenarioList();
                    if (scenarios.length > 0) {
                        this._loadScenario(scenarios[0].id);
                    } else {
                        this.currentScenarioId = null;
                        this.engine = null;
                        this.ui.showEmptyState();
                        this.ui.setChatHeader('Chat Quest');
                    }
                }
            }
        });

        this.ui.on('onAddScenario', () => {
            this._editingScenarioId = null;
            this.ui.openEditor('', true);
            this.ui.closeSidebar();
        });

        this.ui.on('onLoadFile', (file) => this._loadFile(file));

        this.ui.on('onRestart', async () => {
            if (this.engine && this.engine.allowRestart()) {
                const confirmed = await this.ui.confirm(
                    t('confirm'),
                    t('confirmRestart')
                );
                if (confirmed) {
                    this._restartScenario();
                }
            }
        });

        this.ui.on('onChoice', (index) => this._handleChoice(index));

        this.ui.on('onEditorSave', (source) => this._saveScenario(source));

        this.ui.on('onLanguageChange', (lang) => {
            setLanguage(lang);
            storage.saveSettings({ language: lang });
            this._refreshScenarioList();
        });

        this.ui.on('onClearData', async () => {
            const confirmed = await this.ui.confirm(
                t('confirm'),
                t('confirmClearData')
            );
            if (confirmed) {
                storage.clearAllData();
                this.ui.closeSettings();
                // Перезагружаем страницу для чистого старта
                location.reload();
            }
        });
    }

    /**
     * Убеждается что демо-сценарий существует
     */
    async _ensureDemoScenario() {
        const scenarios = storage.getScenarioList();
        const hasDemo = scenarios.some(s => s.isDemo);

        if (!hasDemo) {
            try {
                const { config } = parseScenario(DEMO_SCENARIO);
                storage.saveScenario(
                    config.dialog.id,
                    config.dialog.title,
                    DEMO_SCENARIO,
                    true
                );
            } catch (e) {
                console.error('Failed to load demo scenario:', e);
            }
        }
    }

    /**
     * Обновляет список сценариев в sidebar
     */
    _refreshScenarioList() {
        const scenarios = storage.getScenarioList();
        this.ui.renderScenarioList(scenarios, this.currentScenarioId);
    }

    /**
     * Загружает сценарий по ID
     * @param {string} id
     */
    _loadScenario(id) {
        const source = storage.getScenarioSource(id);
        if (!source) {
            console.error('Scenario not found:', id);
            return;
        }

        try {
            const { config, knots, variables } = parseScenario(source);

            this.engine = new InkEngine(config, knots, variables);
            this.currentScenarioId = id;

            // Сохраняем как текущий
            storage.setCurrentScenarioId(id);

            // Проверяем сохранённый прогресс
            const progress = storage.getProgress(id);
            if (progress && progress.displayedMessages?.length > 0) {
                this.engine.restore(progress);
                this._restoreMessages();
            } else {
                this._startScenario();
            }

            // Обновляем UI
            this.ui.setChatHeader(this.engine.getTitle());
            this.ui.setRestartVisible(this.engine.allowRestart());
            this.ui.hideEmptyState();
            this._refreshScenarioList();

        } catch (e) {
            console.error('Failed to load scenario:', e);
            this.ui.showEditorError(e.message);
        }
    }

    /**
     * Начинает сценарий с начала
     */
    _startScenario() {
        this.ui.clearMessages();
        this.isPlaying = true;
        this._processContent();
    }

    /**
     * Перезапускает сценарий
     */
    _restartScenario() {
        if (this.engine) {
            this.engine.reset();
            storage.deleteProgress(this.currentScenarioId);
            this._startScenario();
        }
    }

    /**
     * Восстанавливает сообщения из сохранения
     */
    _restoreMessages() {
        this.ui.clearMessages();

        const messages = this.engine.getMessages();
        messages.forEach(msg => {
            const character = this.engine.getCharacter(msg.speaker);
            this.ui.addMessage(msg, character);
        });

        this.isPlaying = true;
        this._processContent();
    }

    /**
     * Обрабатывает текущий контент сценария
     */
    async _processContent() {
        if (!this.engine || !this.isPlaying) return;

        const content = this.engine.getCurrentContent();

        switch (content.type) {
            case 'text':
                await this._showTextSequentially(content.data);
                this._processContent();
                break;

            case 'textWithChoices':
                if (content.text.length > 0) {
                    await this._showTextSequentially(content.text);
                }
                this.ui.showChoices(content.choices);
                this._saveProgress();
                break;

            case 'choices':
                this.ui.showChoices(content.choices);
                this._saveProgress();
                break;

            case 'end':
                this.isPlaying = false;
                this.ui.hideChoices();
                this._saveProgress();
                break;
        }
    }

    /**
     * Показывает текстовые сообщения последовательно с typing indicator
     * @param {Array} textItems
     */
    async _showTextSequentially(textItems) {
        for (const item of textItems) {
            const character = this.engine.getCharacter(item.speaker);
            const isPlayer = this.engine.isPlayer(item.speaker);

            // Для NPC показываем typing indicator
            if (!isPlayer) {
                this.ui.showTyping(character);
                const delay = this.engine.calculateTypingDelay(item.text);
                await this._delay(delay);
                this.ui.hideTyping();
            }

            // Показываем сообщение
            const message = {
                speaker: item.speaker,
                text: item.text,
                isPlayer
            };

            this.ui.addMessage(message, character);
            this.engine.addMessage(message);

            // Небольшая пауза между сообщениями
            if (!isPlayer) {
                await this._delay(200);
            }
        }
    }

    /**
     * Обрабатывает выбор пользователя
     * @param {number} index
     */
    async _handleChoice(index) {
        if (!this.engine) return;

        // Получаем текст выбора и показываем как сообщение игрока
        const content = this.engine.getCurrentContent();
        if (content.choices && content.choices[index]) {
            const choice = content.choices[index];

            // Показываем сообщение только если suppressEcho явно false (текст БЕЗ квадратных скобок)
            if (choice.suppressEcho === false) {
                const playerChar = this.engine.getCharacter(
                    this.engine.config.dialog.participants[1]
                );

                const message = {
                    speaker: this.engine.config.dialog.participants[1],
                    text: choice.text,
                    isPlayer: true
                };

                this.ui.addMessage(message, playerChar);
                this.engine.addMessage(message);
            }
        }

        // Скрываем выборы
        this.ui.hideChoices();

        // Делаем выбор в движке
        this.engine.makeChoice(index);

        // Небольшая пауза перед следующим контентом
        await this._delay(300);

        // Продолжаем обработку
        this._processContent();
    }

    /**
     * Сохраняет прогресс
     */
    _saveProgress() {
        if (this.engine && this.currentScenarioId) {
            storage.saveProgress(this.currentScenarioId, this.engine.getState());
        }
    }

    /**
     * Загружает файл сценария
     * @param {File} file
     */
    async _loadFile(file) {
        try {
            const source = await file.text();
            const { config } = parseScenario(source);

            const id = config.dialog.id || generateId();
            storage.saveScenario(id, config.dialog.title || t('untitled'), source, false);

            this._refreshScenarioList();
            this._loadScenario(id);
            this.ui.closeSidebar();

        } catch (e) {
            console.error('Failed to load file:', e);
            alert(t('parseError') + ': ' + e.message);
        }
    }

    /**
     * Сохраняет сценарий из редактора
     * @param {string} source
     */
    _saveScenario(source) {
        try {
            const { config } = parseScenario(source);

            const id = this._editingScenarioId || config.dialog.id || generateId();
            const scenarios = storage.getScenarioList();
            const existing = scenarios.find(s => s.id === id);
            const isDemo = existing?.isDemo || false;

            storage.saveScenario(id, config.dialog.title || t('untitled'), source, isDemo);

            // Если это новый сценарий или редактировали текущий - загружаем его
            const isNew = !this._editingScenarioId;
            if (isNew || id === this.currentScenarioId) {
                storage.deleteProgress(id);
                this._loadScenario(id);
            }

            this._refreshScenarioList();
            this.ui.closeEditor();
            this._editingScenarioId = null;

        } catch (e) {
            console.error('Failed to save scenario:', e);
            this.ui.showEditorError(t('parseError') + ': ' + e.message);
        }
    }

    /**
     * Утилита для задержки
     * @param {number} ms
     * @returns {Promise}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.chatQuestApp = new ChatQuestApp();
});
