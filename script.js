document.documentElement.classList.add("js");

const englishTranslations = {
  "TrueLift | Entrenamiento de fuerza y progresión automática": "TrueLift | Strength training and automatic progression",
  "App de fuerza e hipertrofia que decide cuánto peso cargar en cada serie y te explica por qué. Progresión automática, sin anuncios, sin cuenta y offline. Gratis en Android y iOS.": "Strength and hypertrophy app that decides how much weight to load on every set and explains why. Automatic progression, no ads, no account and offline. Free on Android and iOS.",
  "TrueLift | El entrenador que planifica tu progresión": "TrueLift | The coach that plans your progression",
  "TrueLift decide cuánto peso cargar en cada serie, te explica por qué y frena cuando acumulas fatiga. Gratis, sin anuncios y sin cuenta. 16 sesiones de entrenamiento con PRO incluidas.": "TrueLift decides how much weight to load on every set, explains why and holds back when fatigue builds up. Free, no ads, no account. 16 training sessions with PRO included.",

  "TrueLift inicio": "TrueLift home",
  "Abrir menú": "Open menu",
  "Cómo funciona": "How it works",
  "Progreso": "Progress",
  "Planes": "Plans",
  "Nutrición": "Nutrition",
  "Capturas": "Screenshots",
  "Seleccionar idioma": "Select language",
  "Descargar gratis": "Download free",

  "App de fuerza e hipertrofia · Android y iOS": "Strength and hypertrophy app · Android and iOS",
  "Un entrenador en tu bolsillo.": "A coach in your pocket.",
  "Las apps de registro guardan lo que haces. TrueLift decide lo que haces después: cuánto peso cargar en cada serie, cuándo mantener y cuándo frenar. Y te explica el porqué.": "Workout loggers save what you did. TrueLift decides what you do next: how much weight to load on each set, when to hold and when to back off. And it explains why.",
  "Disponible en Google Play": "Get it on Google Play",
  "Disponible en": "Available on",
  "iOS disponible pronto": "iOS coming soon",
  "Disponible pronto en": "Coming soon to",
  "Abrir aplicación web": "Open web app",
  "Resumen de TrueLift": "TrueLift at a glance",
  "Opiniones de usuarios": "User reviews",
  "Gratis para siempre": "Free forever",
  "Sin anuncios": "No ads",
  "Sin cuenta ni email": "No account or email",
  "16 sesiones de entrenamiento con PRO incluidas": "16 training sessions with PRO included",
  "Sesión en curso: objetivo de repeticiones y RIR, carga sugerida, tu última sesión en verde y explicación de por qué sube la carga": "Session in progress: rep and RIR target, suggested load, your last green session and the reason the load goes up",

  "Por qué TrueLift": "Why TrueLift",
  "Deja de preguntarte si hoy toca subir peso.": "Stop wondering whether today is the day to add weight.",
  "Cada vez que abres una sesión, TrueLift ya ha comparado tu última sesión con tu histórico y ha tomado la decisión por ti.": "Every time you open a session, TrueLift has already compared your last workout with your history and made the call for you.",
  "Si cumples, subes": "Hit the target, move up",
  "Cuando completas las repeticiones con el RIR previsto, calcula una subida proporcionada al ejercicio y cargable con tus discos.": "When you complete the reps at the planned RIR, it calculates an increase that fits the exercise and the plates you own.",
  "Si no llegas, consolidas": "Miss it, consolidate",
  "Si faltan repeticiones o el esfuerzo se dispara, mantiene la carga para que consolides antes de volver a subir.": "If reps are missing or the effort shoots up, it holds the load so you consolidate before moving up again.",
  "Si acumulas fatiga, frena": "Fatigue builds up, it backs off",
  "Tu sueño, estrés, molestias y VFC también cuentan: puede frenar subidas, bajar intensidad o proponer una descarga.": "Your sleep, stress, aches and HRV count too: it can block increases, lower intensity or suggest a deload.",
  "Sin IA improvisando: un algoritmo estable y explicable. Mismos datos, misma decisión, y siempre con el motivo a la vista.": "No AI improvising: a stable, explainable algorithm. Same data, same decision, and the reason is always on screen.",

  "Abre la app, entrena, guarda. El resto lo hace TrueLift.": "Open the app, train, save. TrueLift does the rest.",
  "Pestaña Registro con la sesión que toca y el estado para entrenar de hoy desglosado": "Log tab with today's session and a breakdown of today's readiness to train",
  "Abre la sesión que toca": "Open today's session",
  "Rutina lista desde el primer día según tus días de entreno y tu nivel. Con PRO, un estado diario de 0 a 100 te dice cómo llegas.": "A routine ready from day one, based on your training days and level. With PRO, a daily 0–100 readiness score tells you how you are arriving.",
  "Registro serie a serie con la carga sugerida, el objetivo de repeticiones y RIR y tu última sesión en verde": "Set-by-set logging with the suggested load, the rep and RIR target and your last green session",
  "Registra serie a serie": "Log set by set",
  "Carga sugerida, objetivo de repeticiones y RIR, cronómetro de descanso. Tú solo confirmas lo que has hecho.": "Suggested load, rep and RIR target, rest timer. You just confirm what you did.",
  "Sesión guardada con el rendimiento frente a tu base, tonelaje, series, RPE y duración": "Saved session with performance against your baseline, tonnage, sets, RPE and duration",
  "Guarda y recibe el veredicto": "Save and get the verdict",
  "Rendimiento de la sesión frente a tu histórico y la carga ya programada para la próxima.": "Session performance against your history, and the load already set for the next one.",

  "Mide lo que importa: si de verdad estás progresando.": "Measure what matters: whether you are really progressing.",
  "Nada de gráficas de relleno. Cada dato responde a una pregunta concreta sobre tu entrenamiento.": "No filler charts. Every number answers a specific question about your training.",
  "Rendimiento de cada sesión frente a tu propio histórico, no frente a una tabla.": "Each session's performance against your own history, not against a chart.",
  "Nivel de fuerza por ejercicio según tu peso corporal, sexo y edad.": "Strength level per exercise, relative to your body weight, sex and age.",
  "1RM estimado, tonelaje, marcas personales e informe mensual para compartir.": "Estimated 1RM, tonnage, personal bests and a monthly report to share.",
  "Estado para entrenar y VFC día a día.": "Readiness to train and HRV, day by day.",
  "Capturas de la pestaña Progreso": "Progress tab screenshots",
  "Pestaña Progreso con el estado para entrenar, la valoración general y el rendimiento de sesión": "Progress tab with readiness to train, the overall assessment and session performance",
  "Nivel de fuerza global y por ejercicio, con el progreso hacia el siguiente nivel": "Overall and per-exercise strength level, with progress towards the next level",

  "Gratis vs PRO": "Free vs PRO",
  "Empieza gratis. Pasa a PRO si quieres más control.": "Start free. Go PRO when you want more control.",
  "Gratis": "Free",
  "para siempre": "forever",
  "Todo lo necesario para entrenar en serio.": "Everything you need to train seriously.",
  "Rutina prefijada y progresión automática": "Preset routine and automatic progression",
  "Rutina prefijada, en el gimnasio o en casa, y progresión automática": "Preset routine, at the gym or at home, and automatic progression",
  "Fotos de progreso con la luz igualada y vídeo de tu evolución": "Progress photos with matched light and a video of your progress",
  "Comparador de fotos con la luz igualada y vídeo de tu evolución": "Photo comparison with matched light and a video of your progress",
  "Registro de sesiones y cardio": "Session and cardio logging",
  "Volumen semanal, progreso y marcas personales": "Weekly volume, progress and personal bests",
  "Calculadora de discos, calentamiento y cronómetro": "Plate calculator, warm-up sets and rest timer",
  "Informe mensual y copias de seguridad": "Monthly report and backups",
  "Descargar en Google Play": "Download on Google Play",
  "mensual · anual · pago único": "monthly · annual · one-time",
  "Todo lo de Gratis, más:": "Everything in Free, plus:",
  "Rutina totalmente configurable y rutinas descargables": "Fully configurable routine and downloadable programmes",
  "Autorregulación por sueño, estrés, molestias y VFC": "Autoregulation by sleep, stress, aches and HRV",
  "Descarga guiada y descarga automática por fatiga": "Guided deload and automatic deload on fatigue",
  "Crear ejercicios e importar tu rutina desde Excel": "Create exercises and import your routine from Excel",
  "Modalidades de pago de PRO": "PRO payment options",
  "Mensual": "Monthly",
  "sin permanencia": "cancel anytime",
  "Anual": "Annual",
  "Pago único": "One-time",
  "Probar PRO gratis durante 16 sesiones": "Try PRO free for 16 training sessions",
  "Al instalar tienes PRO completo durante tus primeras 16 sesiones de entrenamiento. Sin email, sin tarjeta, sin cargos automáticos. Si no eliges plan, sigues en la versión gratuita con tu historial intacto.": "When you install, you get full PRO access for your first 16 training sessions. No email, no card, no automatic charges. If you do not pick a plan, you keep the free version with your history intact.",
  "Ver la comparativa completa, función por función": "See the full comparison, feature by feature",
  "Función": "Feature",
  "Registrar sesiones y cardio": "Log sessions and cardio",
  "Volumen y frecuencia semanal": "Weekly volume and frequency",
  "Progreso, marcas personales y rendimiento": "Progress, personal bests and performance",
  "Compartir entrenamiento e informe mensual": "Share workouts and monthly report",
  "Copias de seguridad": "Backups",
  "Cambiar un ejercicio por otro": "Swap one exercise for another",
  "Configurar series, RIR, reps y descanso": "Configure sets, RIR, reps and rest",
  "Cambiar el patrón de un ejercicio y renombrar sesiones": "Change an exercise's movement pattern and rename sessions",
  "Crear ejercicios e importar rutina desde Excel": "Create exercises and import a routine from Excel",
  "Rutinas descargables: express, especialización, peso libre…": "Downloadable programmes: express, specialisation, free weights…",
  "Progresión ajustada a déficit, mantenimiento o superávit": "Progression adjusted to deficit, maintenance or surplus",
  "Plan de nutrición: temporada y ajuste semanal": "Nutrition plan: season and weekly adjustment",
  "Incluido": "Included",
  "No incluido": "Not included",

  "Captura de la pestaña Nutrición": "Nutrition tab screenshot",
  "Pestaña Nutrición con el peso-tendencia, el estado de la fase de déficit y la temporada por bloques": "Nutrition tab with trend weight, the deficit phase status and the season in blocks",
  "Capa de nutrición": "Nutrition layer",
  "Planifica tu temporada. Pésate. Sin contar calorías.": "Plan your season. Weigh yourself. No calorie counting.",
  "Defines tus bloques de volumen, mantenimiento y definición, y cada día anotas solo tu peso. Una vez por semana, la app compara tu ritmo real con el previsto y, si hace falta, te propone un ajuste. Puedes seguirlo de dos formas: eliges una al empezar y la cambias cuando quieras.": "You define your bulking, maintenance and cutting blocks, and each day you log one thing: your weight. Once a week the app compares your real rate with the planned one and, if needed, suggests an adjustment. You can follow it in two ways: you choose one at the start and can change it whenever you want.",
  "Ajustar tu alimentación habitual, si sueles comer parecido cada día: la app te propone cambios concretos, como algo más o menos de un alimento o más pasos, y tú los aplicas por tu cuenta. Sin contar calorías.": "Adjust your usual diet, if you tend to eat similarly every day: the app suggests concrete changes, such as a little more or less of a food or more steps, and you apply them yourself. No calorie counting.",
  "Trabaja con tu peso-tendencia, no con el número de un día suelto.": "It works with your trend weight, not with a single day's reading.",
  "Un semáforo te avisa si el ritmo elegido es sensato para tu punto de partida.": "A traffic light warns you if the chosen rate is sensible for your starting point.",
  "La fase de dieta gobierna la progresión: entrenamiento y nutrición van de la mano.": "The diet phase drives progression: training and nutrition go hand in hand.",

  "Privacidad y sin publicidad": "Privacy and no advertising",
  "Cero publicidad": "Zero advertising",
  "Ni banners, ni vídeos, ni rastreadores. Nada interrumpe tu entrenamiento.": "No banners, videos or trackers. Nothing interrupts your training.",
  "Instala y entrena. No pedimos tu nombre, tu email ni nada de ti.": "Install it and train. We do not ask for your name, your email or anything about you.",
  "Tus datos, en tu móvil": "Your data stays on your phone",
  "Tu rutina y tu historial se procesan en tu dispositivo y el desarrollador no puede consultarlos.": "Your routine and history are processed on your device and the developer cannot access them.",

  "Así se ve TrueLift.": "This is what TrueLift looks like.",
  "Registro": "Log",
  "Sesión en curso": "Session in progress",
  "Sesión guardada": "Saved session",
  "Valoración general": "Overall assessment",
  "Estado para entrenar y rendimiento de una sesión concreta frente a su histórico": "Readiness to train and the performance of one session against its history",
  "Rendimiento por sesión": "Performance per session",
  "Nivel de fuerza": "Strength level",
  "1RM estimado de un ejercicio con la evolución de la carga y del e1RM por sesión": "Estimated 1RM for an exercise with the load and e1RM trend per session",
  "1RM estimado": "Estimated 1RM",
  "VFC y frecuencia cardíaca en reposo por día, con tu banda de referencia y marcas personales": "Daily HRV and resting heart rate with your reference range, and personal bests",
  "VFC · PRO": "HRV · PRO",
  "Nutrición · PRO": "Nutrition · PRO",
  "Ajuste semanal de nutrición expresado en calorías y en gramos de tus propios alimentos": "Weekly nutrition adjustment in calories and in grams of your own foods",
  "Ajuste semanal · PRO": "Weekly adjustment · PRO",
  "Ajustes de la app: rutina, material disponible, autorregulación y VFC, nutrición y modo descarga": "App settings: routine, available equipment, autoregulation and HRV, nutrition and deload mode",
  "Ajustes": "Settings",
  "Desliza para ver más →": "Swipe to see more →",

  "Preguntas frecuentes": "Frequently asked questions",
  "Lo que conviene saber antes de instalar.": "What you should know before installing.",
  "¿Qué incluye la versión gratuita?": "What does the free version include?",
  "Rutina prefijada según tus días de entreno, cambio de ejercicios, registro de sesiones y cardio, progresión automática, volumen semanal, progreso, marcas personales, informe mensual y copias de seguridad. No es una demo: puedes entrenar con ella para siempre.": "A preset routine based on your training days, exercise swaps, session and cardio logging, automatic progression, weekly volume, progress, personal bests, monthly report and backups. It is not a demo: you can train with it forever.",
  "¿Qué pasa cuando completas las 16 sesiones de entrenamiento con PRO?": "What happens when you complete the 16 PRO training sessions?",
  "Ningún cargo: la prueba no pide tarjeta. Al terminar, la app pasa sola a la versión gratuita y eso implica:": "No charge: the trial asks for no card. When it ends, the app switches to the free version by itself, which means:",
  "Las funciones PRO que hubieras activado (autorregulación, VFC, fase de dieta, descarga guiada, nutrición…) quedan desactivadas.": "Any PRO features you had turned on (autoregulation, HRV, diet phase, guided deload, nutrition…) are switched off.",
  "Si personalizaste o importaste tu rutina, vuelves a la rutina estándar de la versión gratuita. Se conservan los cambios de ejercicio que la versión gratuita permite.": "If you customised or imported your routine, you go back to the standard free routine. The exercise swaps the free version allows are kept.",
  "Tu historial de entrenamiento no se pierde y la progresión automática sigue funcionando.": "Your training history is not lost and automatic progression keeps working.",
  "La rutina personalizada no se borra: queda guardada y reaparece tal y como la dejaste si más adelante pasas a PRO.": "Your custom routine is not deleted: it stays saved and comes back exactly as you left it if you upgrade to PRO later.",
  "¿Cómo se paga TrueLift PRO?": "How do I pay for TrueLift PRO?",
  "Como prefieras: suscripción mensual, suscripción anual o un pago único que desbloquea PRO para siempre. Las suscripciones no tienen permanencia. La compra queda asociada a tu cuenta de Google o Apple y puedes restaurarla si cambias de dispositivo.": "However you prefer: a monthly subscription, an annual subscription or a one-time payment that unlocks PRO forever. Subscriptions have no lock-in. The purchase is tied to your Google or Apple account and can be restored if you change device.",
  "¿Tiene publicidad o necesito crear una cuenta?": "Are there ads, or do I need an account?",
  "No y no. TrueLift no muestra publicidad y no requiere registro. Tu historial se procesa en tu móvil y el desarrollador no puede consultarlo; los servicios de compra, descarga y analítica opcional tratan solo los datos descritos en la política de privacidad.": "No and no. TrueLift shows no ads and requires no sign-up. Your history is processed on your phone and the developer cannot access it; the purchase, download and optional analytics services only handle the data described in the privacy policy.",
  "¿Necesito medir la VFC para usar la autorregulación?": "Do I need to measure HRV to use autoregulation?",
  "No. La VFC (variabilidad de la frecuencia cardíaca) es una señal opcional que dan relojes y bandas de pulso y que suele avisar de la fatiga antes que el rendimiento. Si la mides, la app la integra con el resto de señales; si no, la autorregulación funciona con tu descanso, tu estrés, tus molestias y tu rendimiento reciente.": "No. HRV (heart rate variability) is an optional signal from watches and chest straps that usually flags fatigue before performance does. If you measure it, the app blends it with the other signals; if not, autoregulation works from your sleep, stress, aches and recent performance.",
  "¿Sirve para hipertrofia o solo para fuerza?": "Is it for hypertrophy or only for strength?",
  "Las rutinas de la versión gratuita están orientadas a hipertrofia. En PRO puedes configurar series, repeticiones, RIR y descansos para priorizar fuerza si ese es tu objetivo.": "The free routines are geared towards hypertrophy. In PRO you can configure sets, reps, RIR and rest to prioritise strength if that is your goal.",
  "¿Puedo usarla si entreno con mancuernas o máquinas?": "Can I use it if I train with dumbbells or machines?",
  "Sí. Indicas el material que tienes y TrueLift propone cargas que realmente puedas montar con tus discos, microcargas y mancuernas.": "Yes. You tell it the equipment you have and TrueLift suggests loads you can actually set up with your plates, microplates and dumbbells.",
  "¿Dónde puedo consultar el manual de la app?": "Where can I read the app manual?",
  "Puedes": "You can",
  "descargar el manual de TrueLift en PDF": "download the TrueLift manual as a PDF",
  "con la explicación de todas las pantallas y funciones, gratuitas y PRO.": "with an explanation of every screen and feature, free and PRO.",

  "Deja de improvisar. Empieza a progresar.": "Stop improvising. Start progressing.",
  "Gratis, sin anuncios y sin cuenta. Instala, abre la sesión que toca y deja que TrueLift decida la carga.": "Free, no ads, no account. Install it, open today's session and let TrueLift decide the load.",

  "TrueLift - Un entrenador en tu bolsillo.": "TrueLift - A coach in your pocket.",
  "Privacidad y aviso legal": "Privacy and legal notice",
  "Manual (PDF)": "Manual (PDF)",
  "Web del autor": "Author's website",
  "Descargar gratis en Google Play": "Download free on Google Play",
  "Decisión de hoy · Pierna 2": "Today's call · Legs 2",
  "Serie 2/12": "Set 2/12",
  "Carga": "Load",
  "Objetivo": "Target",
  "Mantenemos la carga y seguimos intentando lograr el objetivo.": "We hold the load and keep going for the target.",
  "Descargar en la App Store": "Download on the App Store",
  "16 sesiones PRO incluidas": "16 PRO sessions included",
  "16 sesiones PRO": "16 PRO sessions",
  "Sesión en curso · serie a serie": "Workout in progress · set by set",
  "Rendimiento": "Performance",
  "De cada sesión frente a tu propio histórico, no frente a una tabla.": "Of every session against your own history, not against a table.",
  "Nivel": "Level",
  "De fuerza por ejercicio según tu peso corporal, sexo y edad.": "Of strength per exercise, based on your bodyweight, sex and age.",
  "Marcas": "Records",
  "Estado · PRO": "Readiness · PRO",

  "¿Vienes de otra app? Trae tu historial": "Coming from another app? Bring your history",
  "TrueLift importa tu historial de entrenamiento desde Hevy y Strong con el archivo de exportación que generan esas apps. Tus sesiones, ejercicios, series y cargas entran en TrueLift, así que empiezas con tu progreso real y la progresión automática decide con tus datos desde el primer día.": "TrueLift imports your training history from Hevy and Strong using the export file those apps generate. Your sessions, exercises, sets and loads come across, so you start with your real progress and automatic progression decides using your own data from day one.",
  "Hevy y Strong son marcas de sus respectivos titulares. TrueLift no está afiliada ni asociada a ellas.": "Hevy and Strong are trademarks of their respective owners. TrueLift is not affiliated with or endorsed by them.",
  "Vengo de Hevy o Strong, ¿pierdo mi historial?": "I'm coming from Hevy or Strong. Do I lose my history?",
  "No. TrueLift puede importar tu historial de entrenamiento desde Hevy y Strong a partir del archivo de exportación que generan esas apps: sesiones, ejercicios, series y cargas se incorporan a tu registro y la progresión automática trabaja con tu histórico real, sin empezar de cero. Hevy y Strong son marcas de sus respectivos titulares y TrueLift no está afiliada ni asociada a ellas.": "No. TrueLift can import your training history from Hevy and Strong using the export file those apps generate: sessions, exercises, sets and loads are added to your log, and automatic progression works with your real history instead of starting from scratch. Hevy and Strong are trademarks of their respective owners and TrueLift is not affiliated with or endorsed by them.",

  // Reloj conectado (Health Connect · Apple Salud)
  "Reloj": "Watch",
  "Conecta tu smartwatch": "Connect your smartwatch",
  "Apple Salud": "Apple Health",
  "Apple Watch · Garmin · Samsung Galaxy Watch · Pixel Watch · Polar · y muchos más": "Apple Watch · Garmin · Samsung Galaxy Watch · Pixel Watch · Polar · and many more",
  "Reloj conectado · novedad": "Connected watch · new",
  "Tu reloj ya sabe cómo has dormido. Ahora TrueLift también.": "Your watch already knows how you slept. Now TrueLift does too.",
  "Conecta tu smartwatch o tu pulsera a través de Health Connect en Android o de Apple Salud en iOS. TrueLift aprovecha lo que tu reloj ya mide para ajustar tu entrenamiento y tu nutrición, sin que tengas que anotarlo.": "Connect your smartwatch or fitness band through Health Connect on Android or Apple Health on iOS. TrueLift uses what your watch already measures to adjust your training and nutrition, with nothing to type in.",
  "Del reloj a TrueLift": "From your watch to TrueLift",
  "Tu reloj o pulsera": "Your watch or band",
  "Mide tu sueño, tu pulso, tus pasos y tus entrenos, como ya hace cada día.": "Tracks your sleep, heart rate, steps and workouts, just as it already does every day.",
  "Health Connect · Apple Salud": "Health Connect · Apple Health",
  "La app de tu marca guarda ahí tus datos, dentro de tu propio móvil.": "Your brand's app stores your data there, on your own phone.",
  "Los lee con tu permiso y los tiene en cuenta en cada decisión.": "Reads them with your permission and factors them into every decision.",
  "Si duermes mal, lo tiene en cuenta": "Slept badly? It takes that into account",
  "Tu sueño y tu pulso en reposo llegan solos a tu estado diario. Si hoy vienes cansado, TrueLift lo sabe antes de proponerte subir peso.": "Your sleep and resting heart rate flow straight into your daily readiness. If you show up tired, TrueLift knows before it suggests adding weight.",
  "Tu cardio se apunta solo": "Your cardio logs itself",
  "Las carreras, rutas en bici o sesiones de natación que grabe tu reloj pasan a tu historial con su intensidad y cuentan en tu fatiga.": "The runs, rides and swims your watch records go into your history with their intensity and count towards your fatigue.",
  "Pasos y peso, directos a nutrición": "Steps and weight, straight to nutrition",
  "Tus pasos, tu gasto diario y el peso de tu báscula conectada alimentan la capa de nutrición sin que los copies a mano.": "Your steps, daily energy expenditure and the weight from your connected scale feed the nutrition layer, with no copying by hand.",
  "Solo lectura, nada sale del móvil": "Read-only, nothing leaves your phone",
  "TrueLift solo lee lo que tú autorizas y nunca envía tus datos a ningún servidor. Puedes retirar el permiso cuando quieras.": "TrueLift only reads what you allow and never sends your data to any server. You can revoke access whenever you like.",
  "Relojes y pulseras compatibles": "Compatible watches and bands",
  "Marcas de relojes y pulseras compatibles": "Compatible watch and band brands",
  "Funciona con cualquier reloj, pulsera o báscula cuya app sincronice con Health Connect (Android) o Apple Salud (iOS). Los datos que llegan dependen de lo que comparta la app de cada marca.": "Works with any watch, band or scale whose app syncs with Health Connect (Android) or Apple Health (iOS). Which data comes through depends on what each brand's app shares.",
  "Apple, Apple Watch y Apple Salud son marcas de Apple Inc. Health Connect, Google Pixel Watch y Fitbit son marcas de Google LLC. Las demás marcas citadas pertenecen a sus respectivos titulares. TrueLift no está afiliada ni asociada a ninguna de ellas.": "Apple, Apple Watch and Apple Health are trademarks of Apple Inc. Health Connect, Google Pixel Watch and Fitbit are trademarks of Google LLC. All other brands mentioned belong to their respective owners. TrueLift is not affiliated or associated with any of them.",
  "Reloj conectado: Health Connect y Apple Salud": "Connected watch: Health Connect and Apple Health",
  "Conectar tu smartwatch con Health Connect o Apple Salud": "Connect your smartwatch via Health Connect or Apple Health",
  "Si tu reloj la mide y lo conectas a través de Health Connect o Apple Salud, llega sola, sin anotarla.": "If your watch measures it and you connect it through Health Connect or Apple Health, it comes in on its own, with nothing to type.",
  "¿Qué relojes son compatibles con TrueLift?": "Which watches work with TrueLift?",
  "Cualquier reloj, pulsera o báscula cuya app sincronice con Health Connect en Android o con Apple Salud en iOS: Apple Watch, Garmin, Samsung Galaxy Watch, Google Pixel Watch, Fitbit, Polar, Suunto, Coros, Amazfit, Xiaomi, Withings o Whoop, entre otros. TrueLift no se conecta al reloj directamente: lee lo que la app de tu marca guarda en la plataforma de salud de tu móvil, así que los datos disponibles dependen de lo que esa app comparta.": "Any watch, band or scale whose app syncs with Health Connect on Android or Apple Health on iOS: Apple Watch, Garmin, Samsung Galaxy Watch, Google Pixel Watch, Fitbit, Polar, Suunto, Coros, Amazfit, Xiaomi, Withings or Whoop, among others. TrueLift doesn't connect to the watch directly: it reads what your brand's app stores in your phone's health platform, so the data available depends on what that app shares.",
  "Es una función PRO. Se activa en Ajustes, dentro de Autorregulación y VFC, y el acceso es solo de lectura: puedes retirarlo cuando quieras.": "It's a PRO feature. You turn it on in Settings, under Autoregulation and HRV, and access is read-only: you can revoke it whenever you like.",

  // TrueLift Escritorio y nutrición: calorías, macros, reparto en comidas y menú con IA
  "Secciones": "Sections",
  "Escritorio": "Desktop",
  "Tu entrenador en el bolsillo": "Your coach, in your pocket",
  "Las otras apps guardan lo que haces. TrueLift decide lo que haces después: cuánto peso cargar en cada serie, cuándo avanzar y cuándo frenar. Y además te explica por qué.": "Other apps log what you do. TrueLift decides what you do next: how much weight to load on every set, when to push on and when to hold back. And it tells you why.",
  "Tus métricas de la app en pantalla grande, y algunas más": "Your app metrics on a big screen, plus a few more",
  "TrueLift Escritorio: tus datos en el ordenador": "TrueLift Escritorio: your data on your computer",
  "Nutrición: temporada, ajuste semanal, calorías, macros y menú con IA": "Nutrition: season, weekly adjustment, calories, macros and AI menu",
  "TrueLift Escritorio: tus métricas en el ordenador": "TrueLift Escritorio: your metrics on your computer",
  "Gasto estimado, calorías y macros de tu fase": "Estimated burn, calories and macros for your phase",
  "Reparto en comidas y menú semanal con la IA que elijas": "Meal split and weekly menu with the AI of your choice",
  "Seguir un objetivo de calorías, si tu alimentación varía de un día a otro o quieres más control: una cifra diaria repartida en macros y comidas, y un menú semanal con IA.": "Follow a calorie target, if your eating varies from day to day or you want more control: a daily calorie figure split into macros and meals, plus a weekly menu with AI.",
  "Calorías, macros y menú": "Calories, macros and menu",
  "¿Comes distinto cada día o quieres más control? Sigue un objetivo de calorías.": "Eat differently every day or want more control? Follow a calorie target.",
  "TrueLift convierte tu fase en una cifra diaria de calorías, repartida en macros y comidas, y te ayuda a llevarla a un menú de verdad. Tu báscula sigue mandando: las revisiones semanales actualizan la cifra cuando aceptas sus propuestas.": "TrueLift turns your phase into a daily calorie figure, split into macros and meals, and helps you turn it into a real menu. Your scale still has the final say: weekly reviews update the figure when you accept their proposals.",
  "Cuánto gastas y cuánto comer": "How much you burn and how much to eat",
  "La app estima lo que gastas con tu cuerpo, tu trabajo, tus pasos y tus entrenos, y te da las calorías para perder, mantener o ganar al ritmo de tu fase. Y te enseña de dónde sale cada parte.": "The app estimates what you burn from your body, your job, your steps and your workouts, and gives you the calories to lose, maintain or gain at your phase's pace. It also shows you where each part comes from.",
  "Tus macros del día": "Your daily macros",
  "La proteína recomendada para tu fase, la grasa que prefieras dentro de lo recomendado y los hidratos que cuadran el total, en gramos y en g/kg. ¿Quieres comer otra cifra? La corriges a mano.": "The protein recommended for your phase, the fat you prefer within the recommended range and the carbs that make up the total, in grams and g/kg. Want to eat a different number? Just correct it by hand.",
  "Repartido en tus comidas": "Split across your meals",
  "Elige 3, 4 o 5 comidas y mira las calorías y los gramos de cada una. Hazlas más grandes o más pequeñas y marca la de antes y la de después de entrenar: llevan más hidratos.": "Choose 3, 4 or 5 meals and see the calories and grams in each one. Make them bigger or smaller and mark your pre- and post-workout meals: they get more carbs.",
  "Tu menú semanal con IA": "Your weekly menu with AI",
  "Responde unas preguntas (país, presupuesto, supermercado, tiempo para cocinar, alergias y gustos) y la app prepara el prompt con tus cifras. Lo pegas en la IA que prefieras y te propone un menú de siete días con cantidades, recetas y lista de la compra.": "Answer a few questions (country, budget, supermarket, cooking time, allergies and tastes) and the app writes the prompt with your numbers. Paste it into the AI you prefer and it suggests a seven-day menu with quantities, recipes and a shopping list.",
  "La IA la eliges tú": "You choose the AI",
  "TrueLift no se conecta a ninguna IA: el prompt se prepara en tu móvil y solo sale de él cuando tú lo copias o lo compartes. El menú que proponga la IA es orientativo, así que revisa sus recetas y sus cantidades. Está pensado para adultos sanos y no sustituye el consejo de un profesional.": "TrueLift does not connect to any AI: the prompt is prepared on your phone and only leaves it when you copy or share it. The menu the AI suggests is only a guide, so check its recipes and quantities. It is designed for healthy adults and does not replace advice from a professional.",
  "Tarjeta Energía diaria con el gasto teórico, las calorías ajustadas a tu fase y de dónde sale el gasto": "Daily energy card with the theoretical burn, the calories adjusted for your phase and where the burn comes from",
  "Macros del día: proteína y grasa con su deslizador e hidratos que se ajustan solos, en gramos y en gramos por kilo": "Daily macros: protein and fat with their sliders and carbs that adjust on their own, in grams and grams per kilo",
  "Reparto en comidas con las calorías y los gramos de proteína, hidratos y grasa de cada comida y las comidas de antes y después de entrenar": "Meal split with the calories and grams of protein, carbs and fat for each meal, and the pre- and post-workout meals",
  "Asistente Crea tu menú semanal con IA: país, presupuesto, supermercado y tiempo para cocinar": "Create your weekly menu with AI assistant: country, budget, supermarket and cooking time",
  "TrueLift Escritorio · novedad": "TrueLift Escritorio · new",
  "Tu progreso, en la pantalla grande.": "Your progress, on the big screen.",
  "TrueLift Escritorio es la versión para ordenador de la app. Importas tu copia de seguridad y ves tus métricas con todo detalle, incluidas algunas que no caben en el móvil. Y desde ahí preparas tu próxima rutina.": "TrueLift Escritorio is the desktop version of the app. Import your backup and see your metrics in full detail, including some that do not fit on your phone. And plan your next routine from there.",
  "TrueLift Escritorio, sección Mi resumen: días entrenados, valoración general, peso tendencia, estado para entrenar y lo más relevante de tus datos": "TrueLift Escritorio, My summary section: days trained, overall rating, trend weight, readiness to train and the highlights of your data",
  "Tu bloque en una línea de tiempo: rendimiento por sesión, peso y entrenos sobre las mismas fechas, con las fases de nutrición": "Your block on a timeline: performance per session, weight and workouts on the same dates, with the nutrition phases",
  "Solo en el escritorio": "Desktop only",
  "Tu bloque en una línea de tiempo": "Your block on a timeline",
  "Tus métricas, en grande": "Your metrics, full size",
  "Lo más relevante de tus datos, tu constancia, tu peso y tu estado para entrenar de un vistazo, con gráficas que se leen sin hacer zoom.": "The highlights of your data, your consistency, your weight and your readiness to train at a glance, with charts you can read without zooming in.",
  "Más de lo que cabe en el móvil": "More than fits on your phone",
  "Tu bloque en una línea de tiempo, la comparación de dos periodos, cada serie de cada ejercicio y tu recuperación noche a noche.": "Your block on a timeline, a comparison of two periods, every set of every exercise and your recovery night by night.",
  "Configura tu rutina": "Set up your routine",
  "Edita todos los días a la vista, revisa las series por grupo muscular y exporta la rutina al Excel que importa la app.": "Edit with every day in view, check your sets per muscle group and export the routine to the Excel file the app imports.",
  "Para importarla en la app": "To import it into the app",
  "Informes y evolución física": "Reports and body progress",
  "Un informe del mes para imprimir o guardar en PDF, tus contornos y tus fotos de progreso comparadas lado a lado.": "A monthly report to print or save as a PDF, your body measurements and your progress photos compared side by side.",
  "Un informe del mes para imprimir o guardar en PDF, tus contornos y tus fotos de progreso comparadas lado a lado, con el encuadre que hiciste en la app.": "A monthly report to print or save as a PDF, your body measurements and your progress photos compared side by side, with the framing you did in the app.",
  "Cómo empezar con TrueLift Escritorio": "How to get started with TrueLift Escritorio",
  "En la app": "In the app",
  "Ajustes → Copia de seguridad → Exportar copia. Si quieres, exporta también tus fotos.": "Settings → Backup → Export backup. If you like, export your photos too.",
  "En el ordenador": "On your computer",
  "Abre TrueLift Escritorio y arrastra el archivo a la ventana.": "Open TrueLift Escritorio and drag the file into the window.",
  "Solo en tu navegador": "Only in your browser",
  "Tus datos se procesan y se guardan en tu navegador: TrueLift no los recibe.": "Your data is processed and stored in your browser: TrueLift never receives it.",
  "Abrir TrueLift Escritorio": "Open TrueLift Escritorio",
  "Copia de ejemplo": "Sample backup",
  "Para probarlo sin exportar tus datos": "Try it without exporting your own data",
  "Datos de TrueLift Escritorio": "TrueLift Escritorio at a glance",
  "Sin instalar": "Nothing to install",
  "Por ahora, en español": "Spanish only, for now",
  "Energía diaria · PRO": "Daily energy · PRO",
  "Macros del día · PRO": "Daily macros · PRO",
  "Reparto en comidas · PRO": "Meal split · PRO",
  "Menú con IA · PRO": "AI menu · PRO",
  "¿Puedo ver mis datos de TrueLift en el ordenador?": "Can I see my TrueLift data on my computer?",
  "Sí, con TrueLift Escritorio. Exporta una copia de seguridad desde los ajustes de la app e impórtala en TrueLift Escritorio desde el navegador de tu ordenador: verás tus métricas en grande, algunas que no caben en el móvil, y podrás preparar tu rutina y exportarla al Excel que importa la app.": "Yes, with TrueLift Escritorio. Export a backup from the app settings and import it into TrueLift Escritorio in your computer's browser: you will see your metrics on a big screen, including some that do not fit on your phone, and you can prepare your routine and export it to the Excel file the app imports.",
  "Tus datos se procesan y se guardan solo en tu navegador. Si quieres probarlo antes, en la sección": "Your data is processed and stored only in your browser. If you want to try it first, the",
  "tienes una copia de ejemplo.": "section has a sample backup.",
  "¿TrueLift usa IA para calcular mi dieta?": "Does TrueLift use AI to work out my diet?",
  "No. Las calorías, los macros y el reparto en comidas los calcula la app con un método estable, igual que la progresión. Si quieres un menú semanal, la app prepara un prompt con tus cifras y tus preferencias para que lo pegues en la IA que prefieras. TrueLift no se conecta a ninguna IA ni le envía nada por su cuenta.": "No. Calories, macros and the meal split are worked out by the app with a stable method, just like progression. If you want a weekly menu, the app prepares a prompt with your numbers and preferences for you to paste into the AI you prefer. TrueLift does not connect to any AI or send it anything on its own."
};

const normaliseTranslationKey = (value) => value.replace(/\s+/g, " ").trim();
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const originalMetadata = {
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content || "",
  ogTitle: document.querySelector('meta[property="og:title"]')?.content || "",
  ogDescription: document.querySelector('meta[property="og:description"]')?.content || ""
};

function translatedValue(value, language) {
  const translations = language === "en"
    ? englishTranslations
    : language === "pt-BR"
      ? (typeof portugueseTranslations !== "undefined" ? portugueseTranslations : null)
      : null;
  return translations?.[normaliseTranslationKey(value)] || value;
}

function normaliseLanguage(language) {
  const value = String(language || "").toLowerCase();
  if (value === "en" || value.startsWith("en-")) return "en";
  if (value === "pt" || value.startsWith("pt-")) return "pt-BR";
  return "es";
}

// Las capturas viven en capturas/<idioma>/<nombre>.jpg. Si una captura solo existe
// en algunos idiomas (data-shot-langs en la figura), se oculta en los demás.
const screenshotFolders = {
  es: "capturas/es",
  en: "capturas/en",
  "pt-BR": "capturas/pt-BR"
};

function setScreenshotLanguage(language) {
  document.querySelectorAll("img[data-shot]").forEach((image) => {
    const figure = image.closest("figure");
    const restricted = figure?.dataset.shotLangs;
    if (restricted) {
      const hasLanguage = restricted.split(/\s+/).includes(language);
      figure.hidden = !hasLanguage;
      if (!hasLanguage) return;
    }
    const source = `${screenshotFolders[language]}/${image.dataset.shot}.jpg`;
    if (image.getAttribute("src") !== source) image.setAttribute("src", source);
  });
}

function setPageLanguage(language, { updateUrl = false } = {}) {
  const selectedLanguage = normaliseLanguage(language);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest("script, style")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    }
  });

  let textNode = walker.nextNode();
  while (textNode) {
    if (!originalText.has(textNode)) originalText.set(textNode, textNode.nodeValue || "");
    const source = originalText.get(textNode) || "";
    const key = normaliseTranslationKey(source);
    const translation = translatedValue(key, selectedLanguage);
    if (key && translation !== key) {
      const leading = source.match(/^\s*/)?.[0] || "";
      const trailing = source.match(/\s*$/)?.[0] || "";
      textNode.nodeValue = `${leading}${translation}${trailing}`;
    } else {
      textNode.nodeValue = source;
    }
    textNode = walker.nextNode();
  }

  document.querySelectorAll("[aria-label], [alt], [data-label]").forEach((element) => {
    if (!originalAttributes.has(element)) {
      const values = {};
      ["aria-label", "alt", "data-label"].forEach((name) => {
        if (element.hasAttribute(name)) values[name] = element.getAttribute(name) || "";
      });
      originalAttributes.set(element, values);
    }
    const values = originalAttributes.get(element);
    Object.entries(values).forEach(([name, value]) => {
      element.setAttribute(name, translatedValue(value, selectedLanguage));
    });
  });

  document.title = translatedValue(originalMetadata.title, selectedLanguage);
  const metadata = [
    ['meta[name="description"]', originalMetadata.description],
    ['meta[property="og:title"]', originalMetadata.ogTitle],
    ['meta[property="og:description"]', originalMetadata.ogDescription]
  ];
  metadata.forEach(([selector, source]) => {
    const element = document.querySelector(selector);
    if (element && source) element.setAttribute("content", translatedValue(source, selectedLanguage));
  });

  document.documentElement.lang = selectedLanguage;
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.getAttribute("data-language") === selectedLanguage));
  });

  const privacyPages = {
    es: "privacidad.html",
    en: "privacy.html",
    "pt-BR": "privacidade.html"
  };
  document.querySelectorAll("[data-privacy-link]").forEach((link) => {
    link.setAttribute("href", privacyPages[selectedLanguage]);
  });

  const manualFiles = {
    es: "Manual_TrueLift.pdf",
    en: "Manual_TrueLift_EN.pdf",
    "pt-BR": "Manual_TrueLift_PT-BR.pdf"
  };
  document.querySelectorAll("a[data-manual-download]").forEach((link) => {
    const manualFile = manualFiles[selectedLanguage];
    link.setAttribute("href", manualFile);
    link.setAttribute("download", manualFile);
  });

  setScreenshotLanguage(selectedLanguage);

  try {
    localStorage.setItem("truelift-language", selectedLanguage);
  } catch (_) {
    // El selector funciona igual aunque no haya almacenamiento.
  }

  if (updateUrl && window.history?.replaceState) {
    const url = new URL(window.location.href);
    if (selectedLanguage !== "es") url.searchParams.set("lang", selectedLanguage);
    else url.searchParams.delete("lang");
    window.history.replaceState({}, "", url);
  }
}

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => {
    setPageLanguage(button.getAttribute("data-language") || "es", { updateUrl: true });
  });
});

const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
let storedLanguage = "";
try {
  storedLanguage = localStorage.getItem("truelift-language") || "";
} catch (_) {
  storedLanguage = "";
}
const browserLanguage = navigator.languages?.find((language) => language.toLowerCase().startsWith("pt")) || "";
setPageLanguage(requestedLanguage || storedLanguage || browserLanguage || "es");

// La cabecera es pegajosa y la navegación se desplaza en horizontal cuando no
// cabe, así que no hace falta ni menú desplegable ni CTA fija en móvil.

// Aparición suave al hacer scroll
const revealTargets = document.querySelectorAll("[data-reveal]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (revealTargets.length && "IntersectionObserver" in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
}

// Los CTA genéricos ofrecen ambas tiendas sin JS y en escritorio.
// En móviles llevan directamente a la tienda del dispositivo.
function isAppleMobileDevice() {
  const userAgent = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  // iPadOS 13+ se identifica como Macintosh, pero sí tiene pantalla táctil.
  return /Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1;
}

const mobileStore = isAppleMobileDevice() ? "ios" : /Android/i.test(navigator.userAgent || "") ? "android" : null;
if (mobileStore) {
  document.querySelectorAll("a[data-store-cta]").forEach((link) => {
    const destination = link.getAttribute(`data-store-${mobileStore}`);
    if (destination) link.setAttribute("href", destination);
  });
}
