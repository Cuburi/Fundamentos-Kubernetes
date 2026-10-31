#!/usr/bin/env node
/**
 * Script generador del Muro de Asistentes (ASISTENTES.md) a partir de asistentes.json
 * Garantiza que todos los registros cumplan el estándar visual (avatar .png, badges válidos, sin duplicados).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'asistentes.json');
const MD_PATH = path.join(ROOT, 'ASISTENTES.md');

function cleanGithubUser(input, fallbackUser = '') {
  if (!input) return fallbackUser;
  let val = input.trim();
  if (
    !val ||
    val.toLowerCase() === '_no response_' ||
    val.toLowerCase() === 'no response' ||
    val.toLowerCase() === 'tu-usuario' ||
    val.toLowerCase().includes('tu-usuario')
  ) {
    return fallbackUser;
  }
  // Si pegaron URL completa como https://github.com/usuario.png o https://github.com/usuario/
  val = val.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  val = val.split(/[/?#]/)[0];
  val = val.replace(/\.png$/i, '');
  val = val.replace(/^@/, '').trim();
  return val || fallbackUser;
}

function cleanLinkedin(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === '_no response_' ||
    trimmed.toLowerCase() === 'no response' ||
    trimmed.toLowerCase() === 'n/a' ||
    trimmed.toLowerCase() === 'ninguno' ||
    trimmed.includes('tu-perfil') ||
    trimmed.includes('tu-usuario')
  ) {
    return '';
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith('www.linkedin.com') || trimmed.startsWith('linkedin.com')) {
      trimmed = 'https://' + trimmed;
    } else if (!trimmed.includes('/')) {
      trimmed = `https://www.linkedin.com/in/${trimmed}`;
    } else {
      trimmed = 'https://' + trimmed;
    }
  }
  return trimmed;
}

function parseExtraSocialLinks(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean);
  }
  const str = String(input).trim();
  if (
    !str ||
    str.toLowerCase() === '_no response_' ||
    str.toLowerCase() === 'no response' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'ninguna' ||
    str.toLowerCase() === 'ninguno'
  ) {
    return [];
  }
  return str
    .split(/[\r\n,;]+|\s+(?=https?:\/\/)/)
    .map(s => s.trim())
    .filter(s => s && !s.includes('tu-usuario') && !s.includes('tu-portafolio'))
    .map(s => (/^https?:\/\//i.test(s) ? s : `https://${s}`));
}

function buildSocialBadge(url) {
  const lower = url.toLowerCase();
  if (lower.includes('x.com/') || lower.includes('twitter.com/')) {
    return `[![X](https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white)](${url})`;
  }
  if (lower.includes('instagram.com/')) {
    return `[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=flat-square&logo=instagram&logoColor=white)](${url})`;
  }
  if (lower.includes('youtube.com/') || lower.includes('youtu.be/')) {
    return `[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white)](${url})`;
  }
  if (lower.includes('dev.to/')) {
    return `[![Dev.to](https://img.shields.io/badge/dev.to-0A0A0A?style=flat-square&logo=devdotto&logoColor=white)](${url})`;
  }
  if (lower.includes('medium.com/')) {
    return `[![Medium](https://img.shields.io/badge/Medium-12100E?style=flat-square&logo=medium&logoColor=white)](${url})`;
  }
  if (lower.includes('gitlab.com/')) {
    return `[![GitLab](https://img.shields.io/badge/GitLab-FC6D26?style=flat-square&logo=gitlab&logoColor=white)](${url})`;
  }
  if (lower.includes('twitch.tv/')) {
    return `[![Twitch](https://img.shields.io/badge/Twitch-9146FF?style=flat-square&logo=twitch&logoColor=white)](${url})`;
  }
  if (lower.includes('facebook.com/')) {
    return `[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=flat-square&logo=facebook&logoColor=white)](${url})`;
  }
  if (lower.includes('tiktok.com/')) {
    return `[![TikTok](https://img.shields.io/badge/TikTok-000000?style=flat-square&logo=tiktok&logoColor=white)](${url})`;
  }
  if (lower.includes('bsky.app/')) {
    return `[![Bluesky](https://img.shields.io/badge/Bluesky-0285FF?style=flat-square&logo=bluesky&logoColor=white)](${url})`;
  }
  return `[![Web](https://img.shields.io/badge/Web-4285F4?style=flat-square&logo=google-chrome&logoColor=white)](${url})`;
}

function buildRow(entry) {
  const user = cleanGithubUser(entry.github);
  const nombre = (entry.nombre || user).replace(/\|/g, '').replace(/\r?\n/g, ' ').trim();
  const rol = (entry.rol || 'Tripulante de la Comunidad').replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
  const rango = (entry.rango || '⛵ Marinero').trim();
  const motivacion = (entry.motivacion || 'Aprender y compartir en la comunidad Cloud Native Medellín.').replace(/\|/g, '').replace(/\r?\n/g, ' ').trim();

  const avatar = `<img src="https://github.com/${user}.png?size=50" width="32" height="32" style="border-radius: 50%; vertical-align: middle; margin-right: 8px;"> **${nombre}**`;

  const badges = [
    `[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/${user})`
  ];

  const linkedin = cleanLinkedin(entry.linkedin);
  if (linkedin) {
    badges.push(
      `[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](${linkedin})`
    );
  }

  // Soporte retrocompatible para campo "x" o lista "redes"
  const extraLinks = [];
  if (entry.x && entry.x.trim()) {
    extraLinks.push(entry.x.trim());
  }
  if (entry.redes) {
    for (const link of parseExtraSocialLinks(entry.redes)) {
      if (!extraLinks.includes(link)) {
        extraLinks.push(link);
      }
    }
  }

  for (const link of extraLinks) {
    badges.push(buildSocialBadge(link));
  }

  return `| ${avatar} | ${rol} | ${badges.join('<br>')} | ${rango} | ${motivacion} |`;
}

function renderAsistentesMarkdown(asistentes) {
  const rows = asistentes.map(buildRow).join('\n');

  return `# 🙌 Muro de Asistentes y Tripulación — Cloud Native Medellín 🏔️☕

¡Te damos la bienvenida a bordo! Este muro es el registro histórico de todas las personas que hacen parte de esta travesía de aprendizaje: **De Cero a Capitán en Kubernetes**.

Registrarte en esta tabla es el **Paso 1** de tu viaje. No solo dejas tu huella en un proyecto Open Source, sino que comienzas a construir tu perfil profesional y a conectar con la comunidad Cloud Native de Medellín y Latinoamérica.

---

## 🌍 Una Comunidad para Todos los Perfiles

En este workshop no importa si nunca has abierto una terminal de Linux o si llevas años gestionando servidores en la nube. **Kubernetes se aprende haciendo y compartiendo en comunidad**:

- 💻 **Desarrolladores (Frontend, Backend, Fullstack):** Para aprender a empaquetar aplicaciones en contenedores y entender cómo corren en Kubernetes.
- 🛠️ **DevOps, SREs y Sysadmins:** Para estandarizar procesos de despliegue, dominar alta disponibilidad, autorreparación (_self-healing_) y escalado automático.
- 🧪 **QA y Automatizadores de Pruebas:** Para desplegar entornos de pruebas idénticos a producción en segundos.
- 🎓 **Estudiantes y Nuevos Talentos:** Para dar su primer salto a tecnologías Cloud Native de alta demanda sin barreras de entrada.
- 🏗️ **Líderes Técnicos y Arquitectos:** Para comprender las entrañas de Kubernetes, tomar mejores decisiones de diseño y optimizar costos.

---

## 🏆 Rangos de Navegación (Gamificación)

A medida que avances semana a semana y aportes al repositorio, nuestro bot de GitHub Actions actualizará **automáticamente** tu rango en este muro:

|       Rango        |        Requisito         | Lo que representa en la travesía                                                   |
| :----------------: | :----------------------: | :--------------------------------------------------------------------------------- |
|  **⛵ Marinero**   | Registro o 1 PR aprobado | Te registraste en este muro y zarpó tu primer Pod en el clúster.                   |
|   **🧭 Timonel**   |     3 PRs aprobados      | Tomaste el timón de la nave, resolviste _Retos Rotos_ o aportaste al _Cheatsheet_. |
| **⚓ Capitán K8s** |     6+ PRs aprobados     | Dominas la navegación del clúster, completaste las 6 semanas y el proyecto final.  |

---

## 📝 ¿Cómo agregar tu nombre a este Muro? (Guía paso a paso para principiantes)

Tienes **2 formas** de registrarte. Si estás empezando o no quieres pelearte con código, **usa la Opción 1 (Formulario Visual)**: toma menos de 1 minuto y es imposible equivocarse.

### 🚀 Opción 1: Formulario Visual Automático (Recomendada — Sin tocar código)

No necesitas instalar nada ni descargar el proyecto en tu computador. Solo sigue estos **5 pasos**:

1. **Inicia sesión en GitHub:** Asegúrate de haber iniciado sesión con tu cuenta en [github.com](https://github.com).
2. **Abre el formulario directo:** Haz clic en este botón (se abrirá una ventana de GitHub con casillas para rellenar):
   👉 **[⛵ CLIC AQUÍ PARA ABRIR EL FORMULARIO DE REGISTRO](https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml)**
3. **Completa las casillas del formulario:**
   - **Title (Título arriba):** Ya viene prellenado con \`⛵ Registro de Tripulante: ...\`, puedes dejarlo así o poner tu nombre al final.
   - **1️⃣ Tu Nombre y Apellido \`*\`:** Escribe cómo quieres aparecer en la tabla *(ej: Ana María Gómez)*.
   - **2️⃣ Tu Usuario de GitHub \`*\`:** Escribe tu usuario de GitHub sin espacios *(ej: \`anagomez-dev\`)*. Con este dato el robot pondrá tu foto de perfil automáticamente.
   - **3️⃣ Tu Rol, Especialidad o Carrera \`*\`:** Qué haces o estudias *(ej: Estudiante, Desarrollador Jr, QA, SysAdmin)*.
   - **4️⃣ Enlace a tu LinkedIn *(Opcional)*:** Copia y pega la dirección web de tu perfil de LinkedIn. Si no tienes, déjalo en blanco.
   - **5️⃣ Otras Redes Sociales o Portafolio *(Opcional)*:** Si quieres mostrar tu X/Twitter, Instagram, YouTube, Medium, GitLab o página web, pega el enlace aquí. Si no, déjalo en blanco.
   - **6️⃣ ¿Qué te motivó a unirte? \`*\`:** Escribe en una frase qué te gustaría aprender en el curso.
4. **Envía el formulario:** Baja hasta el final de la página y haz clic en el botón verde que dice **\`Create\`** (o **\`Submit new issue\`**).
5. **¡Magia automática! 🤖✨:**
   - Espera unos **15 a 20 segundos**.
   - Nuestro robot de GitHub Actions leerá tu formulario, validará tus enlaces, te responderá con un mensaje de bienvenida y **actualizará esta tabla automáticamente** con tu foto, tus botones de redes y tu rango de **⛵ Marinero**.

> [!TIP]
> **¿Te equivocaste en algún dato o quieres agregar otra red social después?**  
> ¡No pasa nada! Simplemente vuelve a llenar el formulario y el robot **actualizará tu fila existente** sin duplicarte.

---

### 🛠️ Opción 2: Vía Pull Request desde tu terminal (Para practicar Git)

Si prefieres practicar los comandos de \`git\` (\`clone\`, \`branch\`, \`commit\`, \`push\` y *Pull Request*):

1. Crea tu rama siguiendo la [Guía de Contribución (\`CONTRIBUTING.md\`)](./CONTRIBUTING.md):
   \`\`\`bash
   git checkout -b TU-USUARIO/registro
   \`\`\`
2. Abre el archivo [\`asistentes.json\`](./asistentes.json) y agrega tu bloque al final de la lista (antes del último \`]\`, recuerda poner una coma \`,\` después del bloque anterior):
   \`\`\`json
   {
     "github": "TU-USUARIO",
     "nombre": "Tu Nombre y Apellido",
     "rol": "Tu Rol o Carrera",
     "linkedin": "https://www.linkedin.com/in/tu-perfil",
     "redes": ["https://x.com/tu-usuario", "https://tu-portafolio.dev"],
     "rango": "⛵ Marinero",
     "motivacion": "Tu meta o qué esperas aprender"
   }
   \`\`\`
3. Guarda tus cambios, sube tu rama (\`git add asistentes.json\`, \`git commit -m "Me registro como Marinero"\`, \`git push\`) y abre tu Pull Request en GitHub. ¡Cuando se apruebe, el robot actualizará la tabla de \`ASISTENTES.md\` por ti!

---

## 👥 Muro Oficial de la Tripulación

<!-- INICIO_TABLA_ASISTENTES -->
| 👤 Tripulante | 💼 Rol / Especialidad | 🌐 Redes Profesionales | 🎖️ Rango | 🎯 ¿Qué te motivó a unirte? |
| :--- | :--- | :---: | :---: | :--- |
${rows}
<!-- FIN_TABLA_ASISTENTES -->

> [!TIP]
> **Haz Networking:**  
> Te invitamos a hacer clic en los perfiles de GitHub y LinkedIn de tus compañeros de tripulación. La mayor ventaja del workshop es la red de apoyo y los contactos profesionales que construyes en el camino. 🤝🚀
`;
}

if (require.main === module) {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const map = new Map();
  for (const item of data) {
    const cleanUser = cleanGithubUser(item.github);
    const key = cleanUser.toLowerCase();
    if (!map.has(key)) {
      item.github = cleanUser;
      item.linkedin = cleanLinkedin(item.linkedin);
      map.set(key, item);
    } else {
      const existing = map.get(key);
      if (item.linkedin && cleanLinkedin(item.linkedin)) existing.linkedin = cleanLinkedin(item.linkedin);
      if (item.rol && item.rol !== 'Tripulante de la Comunidad') existing.rol = item.rol;
      if (item.motivacion && !item.motivacion.startsWith('Aporte en PR')) existing.motivacion = item.motivacion;
      if (item.rango && item.rango !== '⛵ Marinero') existing.rango = item.rango;
      if (item.redes) existing.redes = parseExtraSocialLinks(item.redes);
    }
  }
  const deduped = Array.from(map.values());
  fs.writeFileSync(JSON_PATH, JSON.stringify(deduped, null, 2) + '\n', 'utf8');
  const md = renderAsistentesMarkdown(deduped);
  fs.writeFileSync(MD_PATH, md, 'utf8');
  console.log(`✅ ASISTENTES.md generado exitosamente con ${deduped.length} tripulantes.`);
}

module.exports = {
  cleanGithubUser,
  cleanLinkedin,
  parseExtraSocialLinks,
  buildSocialBadge,
  buildRow,
  renderAsistentesMarkdown
};
