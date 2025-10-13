# Personalización de la Home (contenido fijo)

La página principal se edita en `src/app/page.tsx`. Esta versión no depende del panel de administración: todo se controla con constantes en el propio archivo.

## Dónde tocar

1. `INFO_DEFAULT`
   - `nombre`, `slogan`: Títulos del hero y cabecera.
   - `telefono`, `email`, `whatsapp`: Contacto (se genera botón de WhatsApp con wa.me).
   - `direccion`: Se muestra en la tarjeta de contacto.
   - `logoUrl`: Ruta a un logo (ponlo en `public/images`).
   - `fachadaUrl`: Imagen grande del hero (también en `public/images`).
   - `menuPath`: Ruta al menú (por defecto `/menu`).

2. `COORDS_DEFAULT`
   - `lat`, `lng`, `zoom`: Coordenadas del iframe de Google Maps.
   - Obtén lat/lon desde Google Maps (clic en el punto → copia coordenadas).

3. `HORARIOS_DEFAULT`
   - Estructura por día: `[{ abre: 'HH:MM', cierra: 'HH:MM' }, ...]`.
   - Varios tramos son posibles (mediodía/noche). `[]` significa cerrado.

4. Métodos de pago (UI)
   - Actualmente se listan dos entradas fijas (Efectivo, Tarjeta).
   - Modifica el render en la sección “Métodos de pago” para añadir más (p. ej., Bizum).

5. “Sobre nosotros”
   - Edita el texto descriptivo en la sección final.

## SEO Local (JSON‑LD)

El bloque JSON‑LD se genera a partir de las constantes de arriba. Si las cambias, no hace falta tocar nada más.

## Notas de formato

- El archivo está en UTF‑8 para evitar problemas de acentos/ñ.
- No mezclar doble fuente de verdad: si vuelves a activar la configuración desde panel, retira los valores duplicados.

## Próximos pasos opcionales

- Volver a un modo “editable” desde el panel (API + formulario) manteniendo este fallback.
- Añadir validación visual de horarios y vista previa del mapa.

