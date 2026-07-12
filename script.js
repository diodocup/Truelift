document.documentElement.classList.add("js");

const englishTranslations = {
  "TrueLift | El entrenador que planifica tu progresión, no solo la registra": "TrueLift | The coach that plans your progression, not just tracks it",
  "TrueLift no es otra app de registro: planifica tu entrenamiento y tu sobrecarga progresiva con más de 15 señales de rendimiento y recuperación. Gratis con progresión automática incluida; PRO con autorregulación, VFC y deload inteligente. Plan mensual, anual o pago único de por vida.": "TrueLift is more than a workout tracker: it plans your training and progressive overload using over 15 performance and recovery signals. Free with automatic progression; PRO adds autoregulation, HRV and smart deloads. Choose monthly, annual or lifetime access.",
  "TrueLift | El entrenador que planifica tu progresión": "TrueLift | The coach that plans your progression",
  "TrueLift planifica tu entrenamiento y tu sobrecarga progresiva según tu rendimiento y tu recuperación. Pruébala gratis; PRO en plan mensual, anual o pago único de por vida.": "TrueLift plans your training and progressive overload around your performance and recovery. Try it free; PRO is available monthly, annually or as a one-time lifetime purchase.",
  "TrueLift inicio": "TrueLift home",
  "Abrir menú": "Open menu",
  "Por qué TrueLift": "Why TrueLift",
  "Planificación": "Planning",
  "Gratis": "Free",
  "Precios": "Pricing",
  "Capturas": "Screenshots",
  "Manual (PDF)": "Manual (PDF, Spanish)",
  "Seleccionar idioma": "Select language",
  "App de entrenamiento de fuerza adaptativo": "Adaptive strength training app",
  "Un entrenador en tu bolsillo.": "A coach in your pocket.",
  "Las demás apps registran lo que haces. TrueLift planifica lo que haces después: analiza tu rendimiento y tu recuperación y decide cuándo subir peso, cuánto subir, cuándo mantener y cuándo descargar. Y te explica el porqué de cada decisión.": "Other apps record what you do. TrueLift plans what comes next: it analyses your performance and recovery to decide when to add weight, how much to add, when to hold steady and when to deload. And it explains every decision.",
  "Disponible en Google Play": "Get it on Google Play",
  "Disponible en el App Store": "Download on the App Store",
  "Disponible muy pronto": "Coming very soon",
  "Descargar manual (PDF)": "Download manual (Spanish PDF)",
  "Resumen de TrueLift": "TrueLift overview",
  "Gratis para siempre": "Free forever",
  "Rutina, registro, progresión automática y herramientas esenciales. Sin trucos.": "A training plan, workout log, automatic progression and essential tools. No catches.",
  "Sin anuncios ni registro": "No ads or sign-up",
  "Cero publicidad, cero cuentas. Todos tus datos viven en tu dispositivo.": "No ads, no accounts. All your data stays on your device.",
  "Elige tu plan": "Choose your plan",
  "Personalización total, autorregulación, VFC, fase de dieta, deload inteligente y rutinas descargables. Mensual, anual o pago único.": "Full customisation, autoregulation, HRV, nutrition phases, smart deloads and downloadable programmes. Pay monthly, annually or once for life.",
  "28 días de prueba completa": "Full 28-day trial",
  "Prueba todo PRO gratis. Si no lo compras, sigues con la versión gratuita.": "Try every PRO feature for free. If you do not upgrade, you simply keep the free version.",
  "No es un registro. Es un entrenador.": "Not a tracker. A coach.",
  "Las demás apps guardan lo que haces. TrueLift decide lo que haces después.": "Other apps save what you did. TrueLift decides what comes next.",
  "Un cuaderno de gimnasio, aunque sea digital, solo acumula datos y te deja a ti la decisión difícil: ¿subo peso hoy o no? TrueLift evalúa tus datos como lo haría un entrenador: analiza cada sesión, compara tu rendimiento con tu propio histórico y programa la carga de la próxima. Menos incertidumbre y mejores decisiones de carga, en menos tiempo. Y esto no es una función de pago: la progresión automática está incluida en la versión gratuita.": "A training log, even a digital one, only collects data and leaves the hard decision to you: should you add weight today? TrueLift evaluates your data like a coach would. It analyses each workout, compares it with your own history and sets the load for the next one. Better loading decisions, less uncertainty and less time spent planning. Automatic progression is included in the free version.",
  "Privacidad y sin publicidad": "Privacy and no advertising",
  "Cero publicidad": "Zero advertising",
  "Ni banners, ni vídeos, ni rastreadores. Nada interrumpe tu entrenamiento.": "No banners, videos or trackers. Nothing interrupts your training.",
  "Sin registro ni cuenta": "No sign-up or account",
  "Instala y entrena. No pedimos tu email, ni tu nombre, ni nada de ti.": "Install it and train. We do not ask for your email, your name or any personal details.",
  "Tus datos, en tu móvil": "Your data stays on your phone",
  "Todo tu historial vive en tu dispositivo. Tú decides con las copias de seguridad.": "Your entire history stays on your device. You decide where your backups go.",
  "Planificación adaptativa · el corazón de TrueLift": "Adaptive planning · the heart of TrueLift",
  "Más de 15 señales para planificar cada sesión. No solo tus kilos.": "Over 15 signals shape every workout — not just the weight on the bar.",
  "Cada vez que abres una sesión, TrueLift ya ha hecho el trabajo de un entrenador: ha cruzado tu ejecución real, tu rendimiento reciente y tu recuperación para decidir qué te toca hoy. Ninguna app de registro hace esto por ti.": "Whenever you open a workout, TrueLift has already done the planning: it combines what you actually lifted, your recent performance and your recovery to decide what you should do today. An ordinary workout tracker cannot do that for you.",
  "Lo que TrueLift decide por ti": "What TrueLift works out for you",
  "Cuándo subir peso y cuánto subir, con un salto proporcionado al ejercicio.": "When to add weight and by how much, with an increment suited to the exercise.",
  "Cuándo mantener la carga para consolidar antes de volver a subir.": "When to hold the load steady and consolidate before progressing again.",
  "Cuándo frenar, modular la intensidad o proponer una descarga.": "When to ease off, adjust intensity or suggest a deload.",
  "Qué peso montar exactamente con tus discos, microcargas y mancuernas.": "The exact load you can build with your plates, microplates and dumbbells.",
  "Y siempre con el motivo explicado: sabrás por qué te propone cada cosa.": "And the reasoning is always clear, so you know why each change is suggested.",
  "Señales que TrueLift tiene en cuenta": "Signals TrueLift takes into account",
  "Tu ejecución real": "What you actually did",
  "Carga": "Load",
  "Repeticiones": "Repetitions",
  "RIR serie a serie": "RIR for every set",
  "1RM estimado": "Estimated 1RM",
  "Estancamientos": "Plateaus",
  "Parones y vueltas": "Training breaks and returns",
  "Tu rendimiento": "Your performance",
  "Comparación con tu histórico": "Comparison with your training history",
  "Tendencia por ejercicio y sesión": "Trends by exercise and workout",
  "Material disponible": "Available equipment",
  "Tu recuperación": "Your recovery",
  "Sueño": "Sleep",
  "Energía y ánimo": "Energy and mood",
  "Estrés": "Stress",
  "Agujetas y molestias": "Soreness and discomfort",
  "VFC": "HRV",
  "Esfuerzo de sesión (RPE)": "Session effort (RPE)",
  "Carga de cardio": "Cardio load",
  "Fatiga acumulada": "Accumulated fatigue",
  "Tu contexto": "Your circumstances",
  "Fase de dieta: déficit, mantenimiento o superávit": "Nutrition phase: calorie deficit, maintenance or surplus",
  "Molestias por zona: un tren no frena al otro": "Area-specific discomfort: one half of the body does not hold back the other",
  "Progresión automática incluida": "Automatic progression included",
  "Sube el peso solo cuando estés preparado para ello.": "Add weight only when you are ready for it.",
  "TrueLift no sube kilos por calendario ni por intuición. Analiza si has cumplido las repeticiones objetivo, el RIR previsto y tu rendimiento reciente. Si toca progresar, calcula un salto proporcionado al ejercicio y factible con tu material. Si no toca, mantiene la carga para que consolides antes de volver a subir.": "TrueLift does not add weight on a fixed schedule or a hunch. It checks whether you hit the target reps and RIR, along with your recent performance. When it is time to progress, it calculates an exercise-appropriate increment that works with your equipment. Otherwise, it holds the load steady so you can consolidate first.",
  "Lineal simple si estás empezando a entrenar, para avanzar con repeticiones fijas.": "Simple linear progression for beginners, using fixed repetition targets.",
  "Doble progresión si ya tienes experiencia, para acumular reps dentro de un rango antes de subir carga.": "Double progression for experienced lifters, building reps within a range before adding weight.",
  "Pesos adecuados a los discos, microcargas y mancuernas que tienes disponibles.": "Loads matched to the plates, microplates and dumbbells you have available.",
  "Progresión independiente por cada tipo de sesión.": "Independent progression for each workout type.",
  "Captura de progreso de TrueLift": "TrueLift progress screenshot",
  "Pantalla de progreso con disponibilidad reciente, estado para entrenar y rendimiento por sesión": "Progress screen showing recent readiness, training status and workout performance",
  "Algoritmo base incluido": "Core algorithm included",
  "Cada recomendación tiene un motivo.": "Every recommendation has a reason.",
  "En la versión gratuita, TrueLift ya decide cuándo subir, mantener o consolidar. En PRO, añade una segunda capa de control con recuperación, molestias, VFC, fase de dieta y rendimiento reciente.": "Even in the free version, TrueLift decides when to progress, hold or consolidate. PRO adds another layer of control based on recovery, discomfort, HRV, nutrition phase and recent performance.",
  "Si cumples, progresas": "Hit the target, then progress",
  "Cuando completas el objetivo con margen suficiente, la app calcula una subida adecuada.": "When you complete the target with enough reps in reserve, the app calculates a suitable increase.",
  "Si no llegas, consolidas": "Miss the target, then consolidate",
  "Si faltan repeticiones o el RIR no acompaña, mantiene la carga para no forzar una progresión innecesariamente agresiva.": "If you miss reps or your RIR is off target, the load stays the same rather than forcing an overly aggressive increase.",
  "Si acumulas fatiga, frena": "When fatigue builds, ease off",
  "Con autorregulación activa en PRO, TrueLift puede bloquear subidas, bajar intensidad o anticipar una descarga para gestionar mejor la fatiga.": "With PRO autoregulation enabled, TrueLift can pause load increases, reduce intensity or bring a deload forward to manage fatigue.",
  "Todas las versiones · algoritmo sin caja negra": "Every version · no black-box algorithm",
  "Sin IA improvisando. Con un algoritmo estable, explicable y reproducible.": "No AI guesswork. A stable, explainable and repeatable algorithm.",
  "TrueLift no genera tu entrenamiento con un modelo opaco y variable. Usa un algoritmo de progresión ajustado, testeado y validado por usuarios experimentados y entrenadores: mismas entradas, misma lógica, misma decisión.": "TrueLift does not generate your training with an opaque, unpredictable model. It uses a carefully tuned progression algorithm tested and validated by experienced lifters and coaches: the same inputs produce the same reasoning and decision.",
  "Estable": "Consistent",
  "La lógica de progresión no cambia de criterio entre sesiones.": "The progression logic does not change its criteria from one workout to the next.",
  "Explicable y validado": "Explainable and validated",
  "Cada decisión se basa en señales medibles: rendimiento y RIR; en PRO, también recuperación y fase de dieta.": "Every decision is based on measurable signals: performance and RIR, plus recovery and nutrition phase in PRO.",
  "Reproducible": "Repeatable",
  "Con los mismos datos, TrueLift aplica la misma lógica. Sin improvisación.": "Given the same data, TrueLift applies the same logic. No guesswork.",
  "Versión gratuita incluida": "Included in the free version",
  "Todo lo esencial para empezar a entrenar y progresar con criterio.": "Everything you need to train and make sensible progress.",
  "La versión gratuita no es una demo vacía: incluye rutina base, registro, progresión automática, análisis de volumen, progreso, herramientas y copias de seguridad.": "The free version is not a stripped-down demo. It includes a complete starter programme, workout logging, automatic progression, volume analysis, progress tracking, useful tools and backups.",
  "Rutina prefijada": "Ready-made training plan",
  "Parte de una rutina estructurada según seas hombre o mujer y los días que entrenas (de 2 a 5). Elige el sistema de progresión en función de tu nivel y sustituye cada ejercicio según el material disponible, tus preferencias o tus necesidades.": "Start with a structured plan tailored to your sex and training frequency (two to five days per week). Choose a progression system for your experience level and swap any exercise to suit your equipment, preferences or needs.",
  "Registro de sesión": "Workout logging",
  "Elige la carga de tu primera serie y TrueLift ajusta las siguientes referencias de trabajo. Después compara la sesión actual con tu rendimiento anterior y programa la carga de la próxima sesión.": "Choose the load for your first set and TrueLift adjusts the following work sets. It then compares the workout with your previous performance and plans the load for next time.",
  "Volumen semanal": "Weekly volume",
  "Visualiza series efectivas por grupo muscular y frecuencia semanal con una interfaz clara para detectar si te quedas corto o te estás pasando.": "See effective sets by muscle group and weekly frequency at a glance, so you can spot whether you are doing too little or too much.",
  "Progreso y marcas": "Progress and personal bests",
  "En la pestaña Progreso podrás consultar tonelaje de sesión, e1RM estimado, rendimiento, marcas personales e informe mensual listo para guardar o compartir.": "The Progress tab shows workout tonnage, estimated 1RM, performance, personal bests and a monthly report ready to save or share.",
  "Herramientas de apoyo": "Useful training tools",
  "Calculadora de discos, series de calentamiento, cronómetro de descanso, registro de cardio y opción de compartir tus entrenamientos y marcas de forma sencilla.": "Plate calculator, warm-up sets, rest timer, cardio log and simple tools for sharing workouts and personal bests.",
  "Datos bajo tu control": "Your data, under your control",
  "Tu rutina y tu historial viven en tu móvil. Puedes exportar y restaurar copias de seguridad para no perder tu progreso si cambias de dispositivo.": "Your programme and history stay on your phone. You can export and restore backups so your progress is safe when you change devices.",
  "Pantalla de volumen semanal por grupo muscular": "Weekly volume screen by muscle group",
  "Pantalla de registro con estado para entrenar y subida de carga recomendada y explicada": "Workout log showing readiness and an explained load recommendation",
  "Abre el registro de la app y empieza tu entrenamiento sin demoras.": "Open your workout and get straight to training.",
  "TrueLift abre el registro con la sesión que toca, el objetivo de series, repeticiones y RIR, lo que hiciste la vez anterior y la carga indicada para cada ejercicio. Llegas al gimnasio, abres la app y te centras en lo importante: tu entrenamiento.": "TrueLift opens the workout that is due, with target sets, reps and RIR, your previous performance and the planned load for every exercise. At the gym, simply open the app and focus on what matters: your training.",
  "Abre la pestaña Registro y empieza por la sesión que toca.": "Open the Log tab and start the workout that is due.",
  "Confirma carga y RIR, e introduce reps serie a serie mientras entrenas.": "Confirm the load and RIR, then enter reps set by set as you train.",
  "Guarda la sesión y recibe feedback sobre el entrenamiento de hoy.": "Save the workout and get feedback on today's performance.",
  "Personalización y autorregulación": "Customisation and autoregulation",
  "Convierte tu rutina en un sistema de progresión autorregulado.": "Turn your programme into an autoregulated progression system.",
  "Hasta aquí, la versión gratuita. PRO desbloquea la personalización completa de tu rutina y añade una segunda capa de control: estado diario, sueño, estrés, molestias, VFC, fase de dieta, rendimiento reciente, descarga guiada y descarga automática.": "That is what the free version offers. PRO unlocks complete programme customisation and adds another layer of control: daily readiness, sleep, stress, discomfort, HRV, nutrition phase, recent performance, guided deloads and automatic deloads.",
  "No solo registra tu entrenamiento: ajusta la progresión a cómo estás rindiendo y recuperando.": "It does more than log your training: it adjusts progression to how you are performing and recovering.",
  "Opciones de pago de PRO": "PRO payment options",
  "Mensual": "Monthly",
  "Anual": "Annual",
  "sin permanencia": "cancel any time",
  "Pago único": "One-time purchase",
  "tuyo para siempre": "yours for life",
  "Condiciones de la prueba PRO": "PRO trial terms",
  "28 días de prueba PRO completa": "Full 28-day PRO trial",
  "Sin permanencia: cancela cuando quieras": "No commitment: cancel whenever you like",
  "Si no eliges plan, sigues con la versión gratis": "If you do not choose a plan, you keep the free version",
  "Probar PRO gratis 28 días": "Try PRO free for 28 days",
  "Funciones PRO": "PRO features",
  "Rutina totalmente configurable": "Fully customisable programme",
  "Elige tu distribución, patrones de movimiento y ejercicios; ajusta series, RIR, repeticiones y descansos.": "Choose your split, movement patterns and exercises, then set your sets, RIR, reps and rest periods.",
  "Autorregulación real": "Genuine autoregulation",
  "La app tiene en cuenta tu descanso nocturno, estrés, molestias, energía, VFC y rendimiento reciente para decidir el próximo paso.": "The app considers your sleep, stress, discomfort, energy, HRV and recent performance before deciding the next step.",
  "Rutinas personalizadas descargables": "Downloadable training programmes",
  "Biblioteca de rutinas listas para importar: express para días con poco tiempo, especialización en tren superior o inferior, solo peso libre para material limitado… y más en camino.": "A library of ready-to-import programmes: express sessions for busy days, upper- or lower-body specialisation, free-weights-only plans for limited equipment, and more on the way.",
  "Fase de dieta": "Nutrition phase",
  "Modula la respuesta de la progresión en función de tu nutrición: déficit, mantenimiento o superávit.": "Adjust progression to match your nutrition: calorie deficit, maintenance or surplus.",
  "Deload inteligente": "Smart deloads",
  "Activa una descarga guiada cuando lo necesites o deja que TrueLift la proponga al detectar fatiga acumulada o bajón de rendimiento.": "Start a guided deload when you need one, or let TrueLift suggest it when it detects accumulated fatigue or declining performance.",
  "Crea e importa a tu medida": "Create and import your own",
  "Crea tus propios ejercicios e importa tu rutina desde Excel para empezar donde lo dejaste.": "Create your own exercises and import your programme from Excel to pick up where you left off.",
  "Gratis vs PRO · precios": "Free vs PRO · pricing",
  "Empieza gratis. Pasa a PRO cuando quieras más control.": "Start free. Upgrade to PRO when you want more control.",
  "La versión gratuita ya permite entrenar en serio. PRO está pensado para quien quiere personalizarlo todo y ajustar la progresión a su recuperación real. Tú eliges cómo pagarlo: mensual, anual o una sola vez para siempre.": "The free version gives you everything needed for serious training. PRO is for people who want to customise every detail and match progression to real recovery. Choose monthly, annual or one-time lifetime access.",
  "para siempre": "forever",
  "Entrena en serio desde el primer día.": "Train seriously from day one.",
  "Rutina prefijada y progresión automática": "Ready-made programme and automatic progression",
  "Registro de sesiones y cardio": "Workout and cardio logging",
  "Volumen y frecuencia semanal": "Weekly volume and frequency",
  "Progreso, marcas personales y rendimiento": "Progress, personal bests and performance",
  "Calculadora de discos, calentamiento y cronómetro": "Plate calculator, warm-ups and rest timer",
  "Cambiar un ejercicio por otro": "Swap one exercise for another",
  "Informe mensual, compartir y copias de seguridad": "Monthly report, sharing and backups",
  "Descargar gratis": "Download free",
  "mensual · anual · de por vida": "monthly · annual · lifetime",
  "Todo lo de Gratis, más:": "Everything in Free, plus:",
  "Modalidades de pago de PRO": "PRO payment options",
  "Rutina totalmente configurable: series, RIR, reps y descansos": "Fully customisable programme: sets, RIR, reps and rest",
  "Rutinas descargables: express, especialización en tren superior o inferior, solo peso libre…": "Downloadable programmes: express, upper- or lower-body specialisation, free weights only…",
  "Autorregulación por sueño, estrés, molestias y VFC": "Autoregulation using sleep, stress, discomfort and HRV",
  "Progresión ajustada a déficit, mantenimiento o superávit": "Progression adjusted for a calorie deficit, maintenance or surplus",
  "Descarga guiada y descarga automática por fatiga": "Guided and automatic fatigue-based deloads",
  "Cambiar el patrón de un ejercicio y renombrar sesiones": "Change an exercise pattern and rename workouts",
  "Crear ejercicios e importar rutina desde Excel": "Create exercises and import a programme from Excel",
  "Ver la comparativa completa, función por función": "See the full feature-by-feature comparison",
  "Función": "Feature",
  "Incluido": "Included",
  "No incluido": "Not included",
  "Registrar sesiones y cardio": "Log workouts and cardio",
  "Calculadora de discos y calentamiento": "Plate calculator and warm-ups",
  "Cronómetro de descanso con alarma": "Rest timer with alarm",
  "Compartir entrenamiento e informe mensual": "Share workouts and monthly reports",
  "Copias de seguridad": "Backups",
  "Descarga guiada manual (deload)": "Manual guided deload",
  "Configurar series, RIR, reps y descanso": "Configure sets, RIR, reps and rest",
  "Cambiar el patrón de un ejercicio": "Change an exercise's movement pattern",
  "Renombrar las sesiones de la rutina": "Rename programme workouts",
  "Rutinas descargables: express, especialización, peso libre…": "Downloadable programmes: express, specialisation, free weights…",
  "Descarga automática por fatiga o caída de rendimiento": "Automatic deload for fatigue or declining performance",
  "En la versión gratuita la fase de la dieta queda fijada en normocalórica y la autorregulación, la VFC y la descarga guiada están desactivadas. Todo lo demás funciona con normalidad.": "In the free version, the nutrition phase is fixed at maintenance and autoregulation, HRV and guided deloads are disabled. Everything else works as normal.",
  "Capturas de pantalla · gratis y PRO": "Screenshots · Free and PRO",
  "Así se ve TrueLift: visualización clara y eficiente.": "A look inside TrueLift: clear, efficient and easy to read.",
  "Pantallas de la app: volumen, registro, progreso, historial y funciones PRO.": "Explore the app's volume, workout log, progress, history and PRO screens.",
  "Registro de rutina con estado para entrenar y subida de carga recomendada y explicada": "Workout log with readiness status and an explained load recommendation",
  "Seleccionar captura": "Select screenshot",
  "Registro": "Workout log",
  "Registro · RIR": "Workout log · RIR",
  "Autorregulación": "Autoregulation",
  "Progreso · Estado": "Progress · Readiness",
  "Progreso · VFC": "Progress · HRV",
  "Progreso · Tonelaje": "Progress · Tonnage",
  "Progreso · e1RM": "Progress · e1RM",
  "Volumen": "Volume",
  "Rutina PRO": "PRO programme",
  "Registro de rutina con consolidación de carga por RIR inferior al objetivo": "Workout log holding the load because RIR was below target",
  "Formulario de autorregulación diaria con sueño, energía, estrés, dolor articular y VFC": "Daily autoregulation form with sleep, energy, stress, joint discomfort and HRV",
  "Pantalla de progreso con disponibilidad reciente, estado para entrenar y rendimiento de sesión": "Progress screen with recent readiness, training status and workout performance",
  "Pantalla de progreso con rendimiento neto diario, VFC por día y marcas personales": "Progress screen with daily net performance, HRV and personal bests",
  "Pantalla de progreso con tonelaje por sesión, 1RM estimado y evolución de la carga": "Progress screen with workout tonnage, estimated 1RM and load trend",
  "Pantalla de progreso con evolución del e1RM estimado y repeticiones totales por sesión": "Progress screen with estimated 1RM trend and total reps per workout",
  "Pantalla de volumen semanal con series efectivas y frecuencia por grupo muscular": "Weekly volume screen with effective sets and frequency by muscle group",
  "Pantalla de rutina PRO con edición de patrón, ejercicio, series, RIR, repeticiones y descanso": "PRO programme screen for editing movement pattern, exercise, sets, RIR, reps and rest",
  "Preguntas frecuentes": "Frequently asked questions",
  "Lo que conviene saber antes de empezar.": "What you need to know before you start.",
  "¿Qué incluye la versión gratuita?": "What does the free version include?",
  "Incluye rutina prefijada, sustitución de ejercicios, registro de sesiones y cardio, progresión automática, visualización de volumen, progreso y marcas, compartir entrenamientos y copias de seguridad.": "It includes a ready-made programme, exercise substitutions, workout and cardio logging, automatic progression, volume and progress tracking, personal bests, workout sharing and backups.",
  "¿Para quién es TrueLift PRO?": "Who is TrueLift PRO for?",
  "La versión PRO es para ti si quieres personalizar completamente tu rutina, usar autorregulación para ajustar la progresión y acceder a herramientas específicas como creación de ejercicios, importación desde Excel, fase de dieta, descarga guiada, descarga automática y la biblioteca de rutinas descargables: express, especialización en tren superior o inferior, solo peso libre y más.": "PRO is for you if you want to fully customise your programme, use autoregulation to adjust progression and access advanced tools such as custom exercises, Excel imports, nutrition phases, guided and automatic deloads, and a library of downloadable programmes including express sessions, upper- or lower-body specialisation, free-weights-only plans and more.",
  "¿Tiene publicidad o necesito crear una cuenta?": "Does it have ads, or do I need an account?",
  "No y no. TrueLift no muestra ningún tipo de publicidad y no requiere registro: no pedimos tu email ni ningún dato personal. Todos tus datos de entrenamiento se guardan únicamente en tu dispositivo.": "No to both. TrueLift has no advertising and requires no sign-up: we do not ask for your email or any personal details. All your training data is stored only on your device.",
  "¿Cómo se paga TrueLift PRO?": "How do I pay for TrueLift PRO?",
  "Como prefieras: suscripción mensual, suscripción anual o un pago único que desbloquea PRO para siempre. Las suscripciones no tienen permanencia y puedes cancelarlas cuando quieras. La compra queda asociada a tu cuenta de Google y puedes restaurarla si cambias de móvil o reinstalas la app.": "Choose a monthly subscription, an annual subscription or a one-time purchase that unlocks PRO for life. Subscriptions can be cancelled at any time. Your purchase is linked to your Google account and can be restored if you change phones or reinstall the app.",
  "¿Qué pasa cuando terminan los 28 días de prueba PRO?": "What happens when the 28-day PRO trial ends?",
  "Nada malo: la prueba no genera cargos automáticos. Si no eliges ningún plan, sigues usando la versión gratuita con tu rutina y tu historial intactos.": "Nothing disruptive: the trial does not trigger an automatic charge. If you do not choose a plan, you continue with the free version and keep your programme and history intact.",
  "¿Dónde puedo consultar el manual de la app?": "Where can I read the app manual?",
  "Puedes": "You can",
  "descargar el manual de TrueLift en PDF": "download the TrueLift manual as a PDF (in Spanish)",
  "con la explicación de todas las pantallas y funciones, tanto gratuitas como PRO.": "for an explanation of every screen and feature in both Free and PRO.",
  "¿Qué es el RIR y por qué importa?": "What is RIR, and why does it matter?",
  "RIR significa repeticiones en reserva. Un RIR 2 indica que podrías haber hecho dos repeticiones más antes de fallar. Es una señal clave porque no solo mide lo ejecutado, sino también el margen real que te quedaba.": "RIR means reps in reserve. An RIR of 2 means you could have completed two more reps before failure. It matters because it captures not only what you did, but how much genuine capacity you had left.",
  "¿Tengo que medir VFC para utilizar la autorregulación?": "Do I need to measure HRV to use autoregulation?",
  "No. Es una variable más. Si no tienes VFC, la autorregulación funcionará en base a tu estado de recuperación, tus molestias y tu rendimiento reciente.": "No. It is one optional input. Without HRV, autoregulation still works from your recovery, discomfort and recent performance.",
  "¿En qué se diferencia TrueLift de una app normal de registro de gimnasio?": "How is TrueLift different from a standard workout tracker?",
  "Una app de registro guarda lo que haces. TrueLift usa ese registro para calcular tu progresión. En PRO, además, puede modular la intensidad, ajustar la carga y sugerir descargas según tu estado.": "A tracker saves what you do. TrueLift uses that log to calculate your progression. PRO can also adjust intensity and load and suggest deloads based on your readiness.",
  "¿Sirve para hipertrofia o solo para fuerza?": "Is it for hypertrophy, or strength only?",
  "Las rutinas de la versión gratuita tienen un enfoque más orientado a hipertrofia que a fuerza pura. En PRO puedes configurar tu rutina para priorizar adaptaciones de fuerza si ese es tu objetivo.": "The free programmes lean more towards hypertrophy than pure strength. With PRO, you can configure your programme to prioritise strength adaptations if that is your goal.",
  "¿Puedo usarla si entreno con mancuernas o máquinas?": "Can I use it if I train with dumbbells or machines?",
  "Sí. TrueLift calcula pesos cargables según tus discos, microcargas, mancuernas y material disponible.": "Yes. TrueLift calculates achievable loads from the plates, microplates, dumbbells and other equipment available to you.",
  "Deja de improvisar y asegura tu progresión.": "Stop guessing. Start progressing with confidence.",
  "Una app hecha por y para gente que entrena de verdad: todo lo necesario para progresar con criterio, sin publicidad, sin registro y sin funciones de relleno que te distraigan de tu objetivo.": "Built by and for people who train seriously: everything you need to make well-judged progress, with no ads, no sign-up and no filler features getting between you and your goal.",
  "Web del autor": "Developer's website",
  "TrueLift - Un entrenador en tu bolsillo.": "TrueLift — A coach in your pocket.",
  "Privacidad y aviso legal": "Privacy and legal notice",
  "Política de privacidad y aviso legal | TrueLift": "Privacy policy and legal notice | TrueLift",
  "Política de privacidad y aviso legal de TrueLift. La app no muestra publicidad, no requiere registro y todos tus datos se guardan únicamente en tu dispositivo.": "TrueLift privacy policy and legal notice. The app has no advertising, requires no account and stores all your data only on your device.",
  "Volver a la web": "Back to the website",
  "Política de privacidad y aviso legal": "Privacy policy and legal notice",
  "Última actualización: 12 de julio de 2026": "Last updated: 12 July 2026",
  "Resumen en una frase:": "In one sentence:",
  "TrueLift no muestra publicidad, no requiere registro, no recopila datos personales y todo tu historial de entrenamiento se guarda únicamente en tu dispositivo, bajo tu control.": "TrueLift has no advertising, requires no account, collects no personal data and stores your entire training history only on your device, under your control.",
  "1. Responsable": "1. Data controller",
  "Titular y responsable:": "Owner and data controller:",
  "Rubén Soro (desarrollador independiente de TrueLift).": "Rubén Soro (independent developer of TrueLift).",
  "Contacto:": "Contact:",
  "Ámbito:": "Scope:",
  "esta política se aplica a la aplicación móvil TrueLift (Android e iOS) y a este sitio web.": "this policy applies to the TrueLift mobile app (Android and iOS) and this website.",
  "Esta política se redacta conforme al Reglamento (UE) 2016/679, General de Protección de Datos (RGPD), a la Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), y a la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE).": "This policy has been drafted in accordance with Regulation (EU) 2016/679, the General Data Protection Regulation (GDPR); Spanish Organic Law 3/2018 on Personal Data Protection and the guarantee of digital rights (LOPDGDD); and Spanish Law 34/2002 on Information Society Services and Electronic Commerce (LSSI-CE).",
  "2. Privacidad en la aplicación TrueLift": "2. Privacy in the TrueLift app",
  "2.1 No recopilamos tus datos": "2.1 We do not collect your data",
  "TrueLift funciona sin cuenta de usuario y sin registro. La aplicación no solicita tu nombre, tu email ni ningún otro dato identificativo, y el desarrollador": "TrueLift works without an account or sign-up. The app does not ask for your name, email or any other identifying information, and the developer",
  "no recibe, no almacena y no puede acceder": "does not receive, store or have access",
  "a ninguna información tuya.": "to any information about you.",
  "2.2 Tus datos viven en tu dispositivo": "2.2 Your data stays on your device",
  "Toda la información que introduces en la app se guarda exclusivamente en el almacenamiento local de tu dispositivo. Esto incluye:": "All information you enter in the app is stored exclusively in your device's local storage. This includes:",
  "Tu rutina, sesiones de entrenamiento, cargas, repeticiones y RIR.": "Your programme, workouts, loads, repetitions and RIR.",
  "Los cuestionarios diarios de bienestar (sueño, energía, estrés, molestias) si decides usarlos.": "Daily wellbeing questionnaires (sleep, energy, stress and discomfort), if you choose to use them.",
  "Los valores de variabilidad de la frecuencia cardiaca (VFC) que introduzcas manualmente, si decides usarlos.": "Any heart rate variability (HRV) values you enter manually, if you choose to use them.",
  "Los ajustes de la app y tu configuración de material.": "App settings and your equipment configuration.",
  "Estos datos no se envían a ningún servidor. Si desinstalas la aplicación sin exportar una copia de seguridad, se eliminan de forma permanente.": "This data is not sent to any server. If you uninstall the app without exporting a backup, it is permanently deleted.",
  "2.3 Copias de seguridad y datos compartidos": "2.3 Backups and shared data",
  "La exportación de copias de seguridad y la función de compartir entrenamientos generan archivos que se guardan o comparten": "Exporting backups and sharing workouts creates files that are stored or shared",
  "únicamente donde tú decidas": "only where you choose",
  "(tu almacenamiento, tu nube personal o la app con la que compartas). El desarrollador no interviene ni tiene acceso a esos archivos.": "(your storage, personal cloud or the app you share them with). The developer is not involved and has no access to those files.",
  "2.4 Sin publicidad ni rastreadores": "2.4 No advertising or trackers",
  "La aplicación no muestra publicidad de ningún tipo y no incorpora SDK de publicidad, analítica de terceros ni rastreadores.": "The app shows no advertising of any kind and contains no advertising SDKs, third-party analytics or trackers.",
  "2.5 Compras (TrueLift PRO)": "2.5 Purchases (TrueLift PRO)",
  "Las compras y suscripciones de TrueLift PRO se procesan íntegramente a través de": "TrueLift PRO purchases and subscriptions are processed entirely through",
  "(Google Ireland Ltd.) o del": "(Google Ireland Ltd.) or the",
  "(Apple Distribution International Ltd.), que actúan como responsables del tratamiento de tus datos de pago conforme a sus propias políticas de privacidad. El desarrollador no accede en ningún caso a tus datos de pago; únicamente recibe de la plataforma la confirmación anónima de la compra para desbloquear las funciones PRO en tu dispositivo.": "(Apple Distribution International Ltd.). They act as data controllers for your payment data under their own privacy policies. The developer never has access to your payment details and receives only an anonymous purchase confirmation from the platform to unlock PRO features on your device.",
  "2.6 Datos de salud": "2.6 Health data",
  "Los valores opcionales relacionados con tu bienestar (sueño, molestias, VFC) podrían tener la consideración de datos de categoría especial según el art. 9 RGPD. En TrueLift estos datos": "Optional wellbeing information (sleep, discomfort and HRV) may constitute special category data under Article 9 of the GDPR. In TrueLift, this data",
  "solo se procesan localmente en tu dispositivo": "is processed only locally on your device",
  "para modular tu entrenamiento y nunca se comunican al desarrollador ni a terceros. TrueLift es una herramienta de apoyo al entrenamiento: no realiza diagnósticos ni sustituye la valoración de un profesional sanitario.": "to adjust your training and is never disclosed to the developer or third parties. TrueLift is a training support tool: it does not provide diagnoses or replace assessment by a healthcare professional.",
  "3. Privacidad en este sitio web": "3. Privacy on this website",
  "Este sitio es una página estática alojada en GitHub Pages (GitHub, Inc.). No utiliza cookies propias, ni analítica, ni formularios: no recogemos ningún dato de los visitantes. Como en cualquier alojamiento web, GitHub puede registrar datos técnicos de conexión (como la dirección IP) en sus registros de servidor conforme a su": "This is a static website hosted on GitHub Pages (GitHub, Inc.). It uses no first-party cookies, analytics or forms, and we collect no visitor data. As with any web host, GitHub may record technical connection data, such as IP addresses, in its server logs in accordance with its",
  "política de privacidad": "privacy statement",
  ". Las tipografías se cargan desde Google Fonts, lo que implica una petición técnica a servidores de Google al visitar la página.": ". Fonts are loaded from Google Fonts, which involves a technical request to Google's servers when you visit the website.",
  "4. Tus derechos": "4. Your rights",
  "Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad reconocidos por el RGPD escribiendo a": "You may exercise your rights of access, rectification, erasure, objection, restriction and portability under the GDPR by writing to",
  ". Ten en cuenta que, dado que el desarrollador no dispone de datos personales tuyos (todos permanecen en tu dispositivo), el ejercicio efectivo de estos derechos se materializa directamente en la app: puedes consultar, editar, exportar o borrar tus datos en cualquier momento desde la propia aplicación.": ". Please note that because the developer holds none of your personal data — it all remains on your device — these rights can be exercised directly in the app: you can view, edit, export or delete your data at any time.",
  "Si consideras que el tratamiento no se ajusta a la normativa, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (": "If you believe that data processing does not comply with the law, you may lodge a complaint with the Spanish Data Protection Agency (",
  "5. Menores de edad": "5. Children",
  "TrueLift no está dirigida a menores de 14 años. Al no existir registro ni recogida de datos, no se tratan datos personales de menores en ningún caso.": "TrueLift is not intended for children under 14. As there is no registration or data collection, no children's personal data is processed.",
  "6. Aviso legal y condiciones de uso": "6. Legal notice and terms of use",
  "Titular del sitio y de la app:": "Website and app owner:",
  "Propiedad intelectual:": "Intellectual property:",
  "el contenido de este sitio, la marca TrueLift, su logotipo, las capturas y el manual son propiedad de su titular. No está permitida su reproducción con fines comerciales sin autorización.": "the content of this website, the TrueLift brand, its logo, screenshots and manual belong to the owner. They may not be reproduced for commercial purposes without permission.",
  "Uso de la aplicación:": "Use of the app:",
  "TrueLift es una herramienta de planificación y registro de entrenamiento. Sus recomendaciones son orientativas y no constituyen consejo médico. Consulta a un profesional sanitario antes de iniciar un programa de ejercicio, especialmente si tienes alguna patología o lesión.": "TrueLift is a workout planning and logging tool. Its recommendations are for guidance only and do not constitute medical advice. Consult a healthcare professional before starting an exercise programme, particularly if you have a medical condition or injury.",
  "Responsabilidad:": "Liability:",
  "el titular no se hace responsable del mal uso de la aplicación ni de decisiones tomadas exclusivamente en base a sus recomendaciones.": "the owner is not liable for misuse of the app or for decisions made solely on the basis of its recommendations.",
  "Enlaces externos:": "External links:",
  "este sitio contiene enlaces a Google Play, App Store y otros sitios de terceros, cuyas políticas de privacidad son ajenas a este sitio.": "this website contains links to Google Play, the App Store and other third-party websites whose privacy policies are independent of this website.",
  "7. Cambios en esta política": "7. Changes to this policy",
  "Cualquier cambio en esta política se publicará en esta misma página, indicando la fecha de la última actualización. Si un cambio futuro implicara un tratamiento de datos distinto al aquí descrito, se informará de forma destacada y, cuando proceda, se solicitará consentimiento.": "Any changes to this policy will be published on this page with the date of the latest update. If a future change involves data processing beyond what is described here, it will be clearly announced and consent will be requested where required.",
  "8. Legislación aplicable": "8. Governing law",
  "Estas condiciones se rigen por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan conforme a la normativa aplicable en materia de consumidores y usuarios.": "These terms are governed by Spanish law. Any dispute will be subject to the courts with jurisdiction under the applicable consumer and user protection legislation.",
  "Inicio": "Home"
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
  if (language !== "en") return value;
  return englishTranslations[normaliseTranslationKey(value)] || value;
}

function setPageLanguage(language, { updateUrl = false } = {}) {
  const selectedLanguage = language === "en" ? "en" : "es";
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
    if (key && englishTranslations[key] && selectedLanguage === "en") {
      const leading = source.match(/^\s*/)?.[0] || "";
      const trailing = source.match(/\s*$/)?.[0] || "";
      textNode.nodeValue = `${leading}${englishTranslations[key]}${trailing}`;
    } else {
      textNode.nodeValue = source;
    }
    textNode = walker.nextNode();
  }

  document.querySelectorAll("[aria-label], [alt], [data-alt], [data-label]").forEach((element) => {
    if (!originalAttributes.has(element)) {
      const values = {};
      ["aria-label", "alt", "data-alt", "data-label"].forEach((name) => {
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

  document.querySelectorAll('img[src*="play.google.com/intl/"]').forEach((badge) => {
    if (!badge.dataset.spanishSrc) badge.dataset.spanishSrc = badge.getAttribute("src") || "";
    badge.setAttribute("src", selectedLanguage === "en"
      ? "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
      : badge.dataset.spanishSrc);
  });

  document.querySelectorAll('a.store-badge.ios').forEach((link) => {
    if (!link.dataset.spanishHref) link.dataset.spanishHref = link.getAttribute("href") || "";
    link.setAttribute("href", selectedLanguage === "en"
      ? "https://www.apple.com/app-store/"
      : link.dataset.spanishHref);
  });

  try {
    localStorage.setItem("truelift-language", selectedLanguage);
  } catch (_) {
    // The selector still works when storage is unavailable.
  }

  if (updateUrl && window.history?.replaceState) {
    const url = new URL(window.location.href);
    if (selectedLanguage === "en") url.searchParams.set("lang", "en");
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
setPageLanguage(requestedLanguage || storedLanguage || "es");

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      document.body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const gallery = document.querySelector("[data-gallery]");

if (gallery) {
  const image = gallery.querySelector("[data-gallery-image]");
  const buttons = gallery.querySelectorAll("[data-src]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!(image instanceof HTMLImageElement)) return;

      buttons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      image.src = button.dataset.src || image.src;
      image.alt = button.dataset.alt || image.alt;
    });
  });
}

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
