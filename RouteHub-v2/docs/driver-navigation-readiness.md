# Driver Map: alcance y condiciones para pruebas

Revisión: 8 de septiembre de 2026. Esta mejora afecta al GPS dentro del Driver.
No cambia Driver Today, Operation Map (Manager Today/Add Route), Live Map,
asignaciones, estados de paradas, Supabase ni las migraciones.

## Lo que se corrigió

- El canvas Google usa modo vectorial solicitado explícitamente, cámara con rumbo,
  inclinación y zoom de conducción. Si el dispositivo no admite vectorial, Google
  puede usar raster: no se debe prometer inclinación en todos los equipos.
- Un único indicador direccional del conductor, sin un marcador adicional de origen.
  Movimiento de un segundo, sin animación de saltos superiores a 2 km.
- Seguimiento, exploración manual y vista completa separados. Arrastrar o hacer
  zoom suspende el seguimiento; Re-center lo recupera. El mapa no se reconstruye
  por cada actualización GPS. Su tamaño responde al espacio disponible.
- Cabecera de maniobra y resumen inferior compactos, en filas fuera del canvas:
  no ocultan el mapa. Se conservan el header y la navegación inferior de la app.
- Proyección por segmentos, con continuidad en cruces y rutas que regresan por
  una misma calle; gris recorrido y azul pendiente, sin eliminar vértices repetidos.
- Las maniobras se seleccionan por avance y límites de los pasos de Google;
  no por el vértice geográficamente más cercano.
- El ETA aproximado disminuye con la proporción recorrida. Google con tráfico se
  consulta al preparar/recalcular y como máximo cada cinco minutos durante el
  seguimiento normal con GPS válido. No es una consulta por cada render o fix.
- Precisión desconocida y ubicación antigua no se convierten artificialmente en
  GPS válido. Sin posición fiable se pausan instrucciones y ETA; hay recuperación
  GPS mediante una acción explícita del usuario. La voz no anuncia giros con GPS
  obsoleto o fuera del recorrido. El botón Arrived sigue siendo una acción manual.

## Diferencia respecto a un navegador nativo

Maps JavaScript renderiza mapas; no es Google Navigation SDK. La proyección local
sobre una polilínea no sabe identificar carriles, túneles ni distinguir siempre
calles paralelas. El ETA entre consultas usa una aproximación proporcional, no
los tiempos dinámicos de cada calle. No se fabrican límites de velocidad, carriles,
alertas de seguridad ni instrucciones que no estén en la respuesta del proveedor.

Para paridad nativa faltan integración Android/iOS con un Navigation SDK,
seguimiento fiable con pantalla bloqueada, manejo de audio/interrupciones del SO,
map matching de un motor de navegación y un plan offline compatible con el
proveedor. Un contenedor web por sí solo no incorpora esas capacidades.

La PWA necesita pruebas reales antes de usarse como navegación principal.

## Validación reproducible sin tocar datos reales

`npm test` incluye pruebas numéricas de progreso, límites de segmentos, cruces,
pasos de maniobra, ETA, rumbo y GPS inválido. No son solo comparaciones de texto.

La aplicación de prueba está aislada en `tests/fixtures/navigation-preview` y no
forma parte de las rutas publicadas de RouteHub. Se inicia desde la raíz:

```powershell
node node_modules/next/dist/bin/next dev tests/fixtures/navigation-preview --hostname 127.0.0.1 -p 3117
```

Abrir `http://127.0.0.1:3117`. Usa un doble de Maps y posiciones/recorrido ficticios;
no solicita ubicación real ni escribe en la base de datos. Los botones permiten
avanzar, perder precisión, cambiar idioma y tamaños de pantalla. El informe de
dimensiones verifica que los paneles no se solapan con el canvas.

`?real=1` permite verificar el renderizador real de Google con los mismos datos
ficticios, si existe una clave pública válida para localhost. La geometría del
fixture no debe interpretarse como un recorrido real por calles. No prueba Routes.

## Condiciones de aceptación en iPhone y Android reales

Realizar las pruebas con un acompañante; no manipular la app conduciendo.

1. Abrir una parada real: un driver y un destino, ruta correcta sin líneas falsas.
2. Recorrer un tramo recto y dos giros: flecha, rumbo, instrucción y progreso coherentes.
3. Explorar con un dedo y pellizcar: la cámara no vuelve sola. Re-center la recupera.
4. Salirse del recorrido: recalcular tras tres fixes fiables y respetar el enfriamiento.
5. Volver sobre una calle ya recorrida: no saltar a otra parte de la polilínea.
6. Retirar precisión/GPS: pausar voz y ETA; no inventar movimiento ni avance.
7. Perder red: estado de recuperación comprensible, sin una línea recta engañosa.
8. Girar el teléfono: conservar mapa y controles accesibles, sin scroll horizontal.
9. Probar voz, silencio, llamada entrante, suspender/reabrir y batería baja.
10. Arrived/Exit deben conservar el flujo operativo vigente y no completar nada solos.

No se considera listo para lanzamiento hasta documentar esas pruebas en ambos SO.

## Fuentes oficiales consultadas

- Google, vectorial y control de cámara:
  https://developers.google.com/maps/documentation/javascript/webgl
- Google, límites y capacidades del mapa vectorial:
  https://developers.google.com/maps/documentation/javascript/vector-map
- Google, Navigation SDK para navegación integrada nativa:
  https://developers.google.com/maps/documentation/navigation/android-sdk/overview
- Mapbox, estados de progreso y GPS incierto/fuera de ruta:
  https://docs.mapbox.com/android/navigation/guides/turn-by-turn-navigation/route-progress/
- MDN, timestamp real de la posición:
  https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPosition/timestamp
