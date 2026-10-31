#!/usr/bin/env node
/**
 * Script generador del Muro de Asistentes (ASISTENTES.md) y del Mosaico Visual en README.md
 * a partir de asistentes.json y de la validación de contenido real de cada reto en aportes-comunidad/.
 *
 * - Excluye al dueño/instructor (edwinbermudez91) de la tabla de puntajes y lo muestra como Capitán / Instructor.
 * - Valida que cada archivo entregado corresponda realmente al ejercicio de 2.reto-roto/ y tenga la solución aplicada.
 * - Solo otorga los puntos de la semana (+50 XP) cuando el estudiante completa TODOS los ejercicios de esa semana.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'asistentes.json');
const MD_PATH = path.join(ROOT, 'ASISTENTES.md');
const README_PATH = path.join(ROOT, 'README.md');
const SOLUCIONES_DIR = path.join(ROOT, 'aportes-comunidad', 'soluciones-retos');

const INSTRUCTORS = ['edwinbermudez91'];

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

/**
 * Elimina líneas de comentarios (# ...) para validar únicamente las instrucciones reales del Dockerfile o YAML.
 */
function stripComments(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Reglas de validación de contenido real para cada reto roto del repositorio.
 * Evita que alguien suba un archivo cualquiera o deje el reto sin arreglar.
 */
const CHALLENGE_VALIDATORS = {
  'semana-00': [
    {
      id: '01',
      name: '01-dockerfile-roto',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          return /FROM\s+nginx/i.test(code) && /daemon\s+off/i.test(code);
        })
    },
    {
      id: '02',
      name: '02-variable-entorno-faltante',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          return /ENV\s+APP_SECRET_TOKEN/i.test(code);
        })
    },
    {
      id: '03',
      name: '03-contenedor-como-root',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          const isReto03File =
            /0?3/.test(f.relPath) || /RETO\s*3/i.test(f.content) || /root/i.test(f.relPath);
          return (
            isReto03File &&
            /FROM\s+python/i.test(code) &&
            /USER\s+(appuser|10001)/i.test(code)
          );
        })
    },
    {
      id: '04',
      name: '04-dockerignore-y-archivos-secretos',
      validate: files => {
        const hasDockerignore = files.some(
          f =>
            f.relPath.toLowerCase().includes('dockerignore') &&
            /\.env/.test(stripComments(f.content))
        );
        const hasFixedDockerfile = files.some(f => {
          const code = stripComments(f.content);
          const isReto04 = /0?4/.test(f.relPath) || /RETO\s*4/i.test(f.content) || /leak/i.test(f.content);
          return isReto04 && /COPY\s+(--chown=\S+\s+)?app\.py/i.test(code) && !/COPY\s+\.\s+\./i.test(code);
        });
        return hasDockerignore || hasFixedDockerfile;
      }
    },
    {
      id: '05',
      name: '05-puerto-y-host-desalineado',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          const isReto05 = /0?5/.test(f.relPath) || /app\.py$/i.test(f.relPath) || /RETO\s*5/i.test(f.content);
          return isReto05 && /0\.0\.0\.0/.test(code) && /8080/.test(code);
        })
    }
  ],
  'semana-01': [
    {
      id: '01',
      name: '01-pod-con-errores',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          const isReto01 = /name:\s*reto-01-imagen/.test(code) || /0?1/.test(f.relPath);
          return (
            isReto01 &&
            /kind:\s*Pod/.test(code) &&
            /image:\s*nginx:(latest|alpine|1\.\d+)/.test(code) &&
            !code.includes('version-fantasma-999') &&
            /containerPort:\s*80\b/.test(code) &&
            !code.includes('80809')
          );
        })
    },
    {
      id: '02',
      name: '02-pod-crashloop',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          const isReto02 = /name:\s*reto-02-crash/.test(code) || /0?2/.test(f.relPath);
          return (
            isReto02 &&
            /kind:\s*Pod/.test(code) &&
            /\becho\b/.test(code) &&
            !code.includes('echho')
          );
        })
    },
    {
      id: '03',
      name: '03-pod-pendiente-infinito',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          const isReto03 = /name:\s*reto-03-exigente/.test(code) || /0?3/.test(f.relPath);
          return (
            isReto03 &&
            /kind:\s*Pod/.test(code) &&
            /memory:/.test(code) &&
            !code.includes('500Gi') &&
            !code.includes('"64"')
          );
        })
    },
    {
      id: '04',
      name: '04-pod-yaml-molesto',
      validate: files =>
        files.some(f => {
          const code = stripComments(f.content);
          const isReto04 = /name:\s*reto-04-sintaxis/.test(code) || /0?4/.test(f.relPath);
          return (
            isReto04 &&
            /apiVersion:\s*v1\b/.test(code) &&
            !code.includes('apiVersion: v2') &&
            /image:\s*nginx/.test(code) &&
            !code.includes('imaeg:') &&
            /containerPort:\s*80\b/.test(code)
          );
        })
    }
  ]
};

/**
 * Descubre automáticamente las semanas en el repositorio y combina con los validadores de contenido.
 */
function discoverOfficialChallenges() {
  const weeks = {};
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const dir of entries) {
    if (!dir.isDirectory()) continue;
    const match = dir.name.match(/^(semana-\d+)/i);
    if (!match) continue;
    const weekKey = match[1].toLowerCase();
    if (CHALLENGE_VALIDATORS[weekKey]) {
      weeks[weekKey] = CHALLENGE_VALIDATORS[weekKey].map(c => c.id);
      continue;
    }
    const retoDir = path.join(ROOT, dir.name, '2.reto-roto');
    if (!fs.existsSync(retoDir)) continue;
    const items = fs.readdirSync(retoDir);
    const challengeNums = [];
    for (const item of items) {
      const m = item.match(/^(\d{2})-/);
      if (m && !challengeNums.includes(m[1])) {
        challengeNums.push(m[1]);
      }
    }
    challengeNums.sort();
    if (challengeNums.length > 0) {
      weeks[weekKey] = challengeNums;
    }
  }
  return weeks;
}

function listFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  let results = [];
  const list = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of list) {
    if (entry.name === '.git' || entry.name === '.DS_Store') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFilesRecursive(fullPath));
    } else if (entry.name.toLowerCase() !== 'readme.md') {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Evalúa los ejercicios resueltos por un estudiante en aportes-comunidad/soluciones-retos/<usuario>/
 * Regla estricta:
 * - Registro inicial = 10 XP
 * - Cada ejercicio se valida contra el contenido real de 2.reto-roto/
 * - Solo se otorgan los +50 XP de la semana cuando TODOS los ejercicios de esa semana están resueltos y validados (ej. 5/5 en Semana 00, 4/4 en Semana 01).
 */
function evaluateUserProgress(githubUser, officialChallenges) {
  const cleanUser = cleanGithubUser(githubUser);
  let points = 10; // 10 XP base por registrarse
  let completedWeeksCount = 0;
  const weekSummaries = [];
  const detailedReport = [];

  let userSolDir = null;
  if (fs.existsSync(SOLUCIONES_DIR)) {
    const dirs = fs.readdirSync(SOLUCIONES_DIR, { withFileTypes: true });
    const found = dirs.find(d => d.isDirectory() && d.name.toLowerCase() === cleanUser.toLowerCase());
    if (found) {
      userSolDir = path.join(SOLUCIONES_DIR, found.name);
    }
  }

  for (const [weekKey, expectedNums] of Object.entries(officialChallenges)) {
    const totalExpected = expectedNums.length;
    let solvedCount = 0;
    const missingNums = [];
    const solvedNums = [];

    if (userSolDir) {
      const weekDirs = fs.readdirSync(userSolDir, { withFileTypes: true });
      const matchingWeekDir = weekDirs.find(
        d => d.isDirectory() && d.name.toLowerCase().startsWith(weekKey)
      );
      if (matchingWeekDir) {
        const weekPath = path.join(userSolDir, matchingWeekDir.name);
        const filePaths = listFilesRecursive(weekPath);
        const files = filePaths.map(fp => ({
          relPath: path.relative(weekPath, fp),
          content: fs.readFileSync(fp, 'utf8')
        }));

        const validators = CHALLENGE_VALIDATORS[weekKey];
        if (validators) {
          for (const v of validators) {
            if (v.validate(files)) {
              solvedNums.push(v.id);
            } else {
              missingNums.push(`${v.id} (${v.name})`);
            }
          }
          solvedCount = solvedNums.length;
        } else {
          for (const num of expectedNums) {
            const numInt = parseInt(num, 10);
            const regex = new RegExp(`(^|[^0-9])(0?${numInt})([^0-9]|$)`);
            if (files.some(f => regex.test(f.relPath) && stripComments(f.content).length > 10)) {
              solvedNums.push(num);
            } else {
              missingNums.push(num);
            }
          }
          solvedCount = solvedNums.length;
        }
      } else {
        missingNums.push(...expectedNums);
      }
    } else {
      missingNums.push(...expectedNums);
    }

    const isComplete = solvedCount === totalExpected && totalExpected > 0;
    const shortLabel = weekKey.replace('semana-', 'Sem ');

    if (isComplete) {
      points += 50; // +50 XP al completar el 100% de los retos rotos de la semana
      completedWeeksCount += 1;
      weekSummaries.push(`✅ ${shortLabel}: ${solvedCount}/${totalExpected}`);
    } else if (solvedCount > 0) {
      // No suma puntos hasta completar todos los ejercicios de la semana, pero muestra su avance
      weekSummaries.push(`⏳ ${shortLabel}: ${solvedCount}/${totalExpected} (Incompleta)`);
    }

    detailedReport.push({
      weekKey,
      solvedCount,
      totalExpected,
      isComplete,
      solvedNums,
      missingNums
    });
  }

  let rango = '⛵ Marinero';
  if (completedWeeksCount >= 6) {
    rango = '⚓ Capitán K8s';
  } else if (completedWeeksCount >= 2) {
    rango = '🧭 Timonel';
  }

  const summaryText =
    weekSummaries.length > 0
      ? `**${points} XP** (${weekSummaries.join(' • ')})`
      : `**${points} XP** (Registro inicial)`;

  return {
    points,
    completedWeeksCount,
    rango,
    summaryText,
    detailedReport
  };
}

function buildSocialBadgesString(entry) {
  const user = cleanGithubUser(entry.github);
  const badges = [
    `[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/${user})`
  ];

  const linkedin = cleanLinkedin(entry.linkedin);
  if (linkedin) {
    badges.push(
      `[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](${linkedin})`
    );
  }

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

  return badges.join('<br>');
}

function buildStudentRow(entry, rankPosition) {
  const user = cleanGithubUser(entry.github);
  const nombre = (entry.nombre || user).replace(/\|/g, '').replace(/\r?\n/g, ' ').trim();
  const rol = (entry.rol || 'Tripulante de la Comunidad').replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
  const rango = (entry.rango || '⛵ Marinero').trim();
  const progreso = entry.progresoTexto || `**${entry.puntos || 10} XP** (Registro inicial)`;
  const motivacion = (entry.motivacion || 'Aprender y compartir en la comunidad Cloud Native Medellín.').replace(/\|/g, '').replace(/\r?\n/g, ' ').trim();

  let medal = `#${rankPosition}`;
  if (entry.puntos > 10) {
    if (rankPosition === 1) medal = '🥇 #1';
    else if (rankPosition === 2) medal = '🥈 #2';
    else if (rankPosition === 3) medal = '🥉 #3';
  }

  const avatar = `<img src="https://github.com/${user}.png?size=50" width="32" height="32" style="border-radius: 50%; vertical-align: middle; margin-right: 8px;"> **${nombre}**`;
  const badgesStr = buildSocialBadgesString(entry);

  return `| ${medal} | ${avatar} | ${rol} | ${badgesStr} | ${rango}<br><sub>${progreso}</sub> | ${motivacion} |`;
}

function buildReadmeMosaicSection(students) {
  const cols = 6;
  const rowsHtml = [];
  for (let i = 0; i < students.length; i += cols) {
    const chunk = students.slice(i, i + cols);
    const cells = chunk.map((entry, idx) => {
      const pos = i + idx + 1;
      const user = cleanGithubUser(entry.github);
      const fullName = (entry.nombre || user).replace(/<[^>]*>/g, '').trim();
      const parts = fullName.split(/\s+/);
      const shortName = parts.length > 2 ? `${parts[0]} ${parts[1]}` : fullName;
      const rango = (entry.rango || '⛵ Marinero').trim();
      const xp = entry.puntos || 10;
      let medal = '';
      if (xp > 10) {
        if (pos === 1) medal = '🥇 ';
        else if (pos === 2) medal = '🥈 ';
        else if (pos === 3) medal = '🥉 ';
      }
      const profileLink = cleanLinkedin(entry.linkedin) || `https://github.com/${user}`;
      return `    <td align="center" width="140">\n      <a href="${profileLink}" title="${fullName} (@${user}) — ${xp} XP">\n        <img src="https://github.com/${user}.png?size=100" width="64" height="64" style="border-radius: 50%;" alt="${user}"/><br/>\n        <sub><b>${medal}${shortName}</b></sub>\n      </a><br/>\n      <sub>${rango} • <b>${xp} XP</b></sub>\n    </td>`;
    });
    rowsHtml.push(`  <tr>\n${cells.join('\n')}\n  </tr>`);
  }

  return `<!-- INICIO_MOSAICO_TRIPULACION -->
## 👥 Tripulación a Bordo y Ranking (${students.length} Tripulantes)

<div align="center">

[![Tripulantes a Bordo](https://img.shields.io/badge/⛵_Tripulantes_a_Bordo-${students.length}-00C7B7?style=for-the-badge)](./ASISTENTES.md)
[![Registrarme en 30 seg](https://img.shields.io/badge/➕_¡Regístrate_Aquí!_(Formulario_Visual)-2ea44f?style=for-the-badge&logo=github)](https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml)
[![Actualizar mis Datos](https://img.shields.io/badge/✏️_Actualizar_mis_Datos_o_Redes-f57c00?style=for-the-badge&logo=github)](https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml)
[![Ver Ranking Completo](https://img.shields.io/badge/🏆_Ver_Tabla_de_Puntajes_y_Redes-326CE5?style=for-the-badge)](./ASISTENTES.md)

<table>
${rowsHtml.join('\n')}
</table>

<sub>💡 <b>¿Aún no apareces aquí o quieres actualizar tu LinkedIn/Redes?</b> Haz clic en <a href="https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml"><b>➕ Registrarme / ✏️ Actualizar mis Datos</b></a> y nuestro bot actualizará tu tarjeta automáticamente en 15 segundos.</sub>

</div>
<!-- FIN_MOSAICO_TRIPULACION -->`;
}

function updateReadmeWithMosaic(students, readmeContent) {
  const mosaicBlock = buildReadmeMosaicSection(students);
  const startMarker = '<!-- INICIO_MOSAICO_TRIPULACION -->';
  const endMarker = '<!-- FIN_MOSAICO_TRIPULACION -->';

  if (readmeContent.includes(startMarker) && readmeContent.includes(endMarker)) {
    const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
    return readmeContent.replace(regex, mosaicBlock);
  }

  const targetHeading = '## 🏆 Rangos de Navegación (Gamificación)';
  if (readmeContent.includes(targetHeading)) {
    return readmeContent.replace(targetHeading, `${mosaicBlock}\n\n---\n\n${targetHeading}`);
  }
  return readmeContent + '\n\n' + mosaicBlock + '\n';
}

function renderAsistentesMarkdown(students, instructorEntry, officialChallenges) {
  const rows = students.map((s, idx) => buildStudentRow(s, idx + 1)).join('\n');

  const weekChallengesText = Object.entries(officialChallenges)
    .map(([week, nums]) => `\`${week}\` (${nums.length} retos rotos)`)
    .join(', ');

  let instructorCard = '';
  if (instructorEntry) {
    const instBadges = buildSocialBadgesString(instructorEntry).replace(/<br>/g, ' &nbsp; ');
    instructorCard = `
## 👨‍🏫 Capitán de la Nave (Instructor y Mantenedor)

| 👤 Instructor | 💼 Especialidad | 🌐 Redes Profesionales | 🎯 Misión en la Comunidad |
| :--- | :--- | :---: | :--- |
| <img src="https://github.com/edwinbermudez91.png?size=50" width="36" height="36" style="border-radius: 50%; vertical-align: middle; margin-right: 8px;"> **Edwin Bermúdez** | 👨‍🏫 Instructor<br>Senior DevOps & SRE | ${instBadges} | Compartir conocimiento y fortalecer la comunidad Cloud Native en Medellín. 🏔️☕ |

---
`;
  }

  return `# 🙌 Muro de Asistentes y Ranking de la Tripulación — Cloud Native Medellín 🏔️☕

¡Te damos la bienvenida a bordo! Este muro es el registro histórico y la **tabla de posiciones (Leaderboard)** de todas las personas que hacen parte de esta travesía de aprendizaje: **De Cero a Capitán en Kubernetes**.

<div align="center">

[![Registrarme en 30 seg](https://img.shields.io/badge/➕_¡Regístrate_Aquí!_(Nuevos_Tripulantes)-2ea44f?style=for-the-badge&logo=github)](https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml)
[![Actualizar mis Datos](https://img.shields.io/badge/✏️_Actualizar_mis_Datos_o_Redes_Sociales-f57c00?style=for-the-badge&logo=github)](https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml)

</div>

---

## 🏆 Sistema de Puntaje (XP) y Validación de Retos Rotos

A medida que avances semana a semana, nuestro bot de GitHub Actions inspeccionará tu carpeta \`aportes-comunidad/soluciones-retos/<tu-usuario>/semana-XX/\`, **validará que cada solución corresponda realmente al ejercicio de \`2.reto-roto/\`** y actualizará tu puntaje en este muro:

| Acción / Logro | Puntos (XP) | Regla de Validación Estricta |
| :--- | :---: | :--- |
| **1. Registro en el Muro** | **+10 XP** | Por registrarte en el formulario o vía Pull Request. |
| **2. Semana 100% Completada y Validada** | **+50 XP por semana** | **¡Todo o Nada por Semana!** Debes resolver y subir **TODOS los retos rotos** de la semana (${weekChallengesText}). Si subes solo 1 ejercicio o un archivo que no corresponde al reto, la semana queda como \`⏳ Incompleta\` y no suma los 50 XP hasta completarla. |

### 🎖️ Requisitos para subir de Rango:
| Rango | Requisito | Lo que representa en la travesía |
| :---: | :---: | :--- |
| **⛵ Marinero** | Registro inicial (**10 XP**) | Te registraste en este muro y zarpó tu primer Pod en el clúster. |
| **🧭 Timonel** | **2+ Semanas Completadas al 100% (110+ XP)** | Resolviste y validaste **todos** los ejercicios de los _Retos Rotos_ de al menos 2 semanas. |
| **⚓ Capitán K8s** | **6 Semanas Completadas al 100% (310+ XP)** | Dominas la navegación del clúster, completaste todos los ejercicios de las 6 semanas y el proyecto final. |

---

## 📝 ¿Cómo registrarte o actualizar tus datos? (Guía paso a paso)

Tanto si eres **nuevo/a** como si **ya estás en la tabla y quieres corregir tu nombre, rol o agregar tus redes sociales (LinkedIn, X, Portafolio, etc.)**, usa el mismo Formulario Visual:

### 🚀 Opción 1: Formulario Visual Automático (Para Registrarte o Actualizar tus Datos)

No necesitas instalar nada ni tocar código. Sigue estos **5 pasos**:

1. **Inicia sesión en GitHub:** Asegúrate de haber iniciado sesión con tu cuenta en [github.com](https://github.com).
2. **Abre el formulario directo:** Haz clic en cualquiera de estos dos enlaces (ambos abren el formulario oficial):
   - 👉 **[➕ Registrarme por primera vez en el Muro](https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml)**
   - 👉 **[✏️ Actualizar mis datos, rol o agregar mi LinkedIn / Redes](https://github.com/edwinbermudez91/Fundamentos-Kubernetes/issues/new?template=registro-asistente.yml)**
3. **Completa las casillas del formulario:**
   - **Title (Título arriba):** Ya viene prellenado, puedes dejarlo así o poner tu nombre.
   - **1️⃣ Tu Nombre y Apellido \`*\`:** Escribe cómo quieres aparecer en la tabla *(ej: Ana María Gómez)*.
   - **2️⃣ Tu Usuario de GitHub \`*\`:** Escribe tu usuario exacto de GitHub sin espacios *(ej: \`anagomez-dev\`)*. Con este dato el robot ubicará tu perfil, pondrá tu foto oficial y actualizará tus datos sin duplicarte.
   - **3️⃣ Tu Rol, Especialidad o Carrera \`*\`:** Qué haces o estudias *(ej: Estudiante, Desarrollador Jr, QA, SysAdmin)*.
   - **4️⃣ Enlace a tu LinkedIn *(Opcional)*:** Copia y pega la dirección web de tu perfil de LinkedIn.
   - **5️⃣ Otras Redes Sociales o Portafolio *(Opcional)*:** Si quieres mostrar tu X/Twitter, Instagram, YouTube, Medium, GitLab o página web, pega el enlace aquí.
   - **6️⃣ ¿Qué te motivó a unirte? \`*\`:** Escribe en una frase qué te gustaría aprender en el curso.
4. **Envía el formulario:** Baja hasta el final de la página y haz clic en el botón verde que dice **\`Create\`** (o **\`Submit new issue\`**).
5. **¡Actualización en 15 segundos! 🤖✨:**
   - Nuestro robot de GitHub Actions leerá tu formulario, actualizará esta tabla y la portada del repositorio, conservará tus puntos ganados y cerrará el ticket automáticamente.

---

### 🛠️ Opción 2: Vía Pull Request desde tu terminal (Para practicar Git)

Si prefieres hacerlo con comandos de \`git\`, edita tu bloque en [\`asistentes.json\`](./asistentes.json):
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

---
${instructorCard}
## 👥 Tabla de Posiciones de la Tripulación (${students.length} Tripulantes)

<!-- INICIO_TABLA_ASISTENTES -->
| # | 👤 Tripulante | 💼 Rol / Especialidad | 🌐 Redes Profesionales | 🎖️ Rango y Progreso (XP) | 🎯 ¿Qué te motivó a unirte? |
| :---: | :--- | :--- | :---: | :---: | :--- |
${rows}
<!-- FIN_TABLA_ASISTENTES -->

> [!TIP]
> **Haz Networking:**  
> Te invitamos a hacer clic en los perfiles de GitHub y LinkedIn de tus compañeros de tripulación. La mayor ventaja del workshop es la red de apoyo y los contactos profesionales que construyes en el camino. 🤝🚀
`;
}

function processAndSortData(rawData) {
  const officialChallenges = discoverOfficialChallenges();
  const map = new Map();

  for (const item of rawData) {
    const cleanUser = cleanGithubUser(item.github);
    const key = cleanUser.toLowerCase();
    if (!map.has(key)) {
      item.github = cleanUser;
      item.linkedin = cleanLinkedin(item.linkedin);
      item.redes = parseExtraSocialLinks(item.redes);
      if (item.x && !item.redes.includes(item.x)) item.redes.push(item.x);
      delete item.x;
      map.set(key, item);
    } else {
      const existing = map.get(key);
      if (item.linkedin && cleanLinkedin(item.linkedin)) existing.linkedin = cleanLinkedin(item.linkedin);
      if (item.rol && item.rol !== 'Tripulante de la Comunidad') existing.rol = item.rol;
      if (item.motivacion && !item.motivacion.startsWith('Aporte en PR')) existing.motivacion = item.motivacion;
      if (item.redes) {
        for (const r of parseExtraSocialLinks(item.redes)) {
          if (!existing.redes.includes(r)) existing.redes.push(r);
        }
      }
    }
  }

  let instructorEntry = null;
  const students = [];

  let orderIndex = 0;
  for (const item of map.values()) {
    const isInstructor = INSTRUCTORS.includes(item.github.toLowerCase());
    if (isInstructor) {
      item.rango = '⚓ Capitán K8s';
      instructorEntry = item;
    } else {
      const evalResult = evaluateUserProgress(item.github, officialChallenges);
      item.rango = evalResult.rango;
      item.puntos = evalResult.points;
      item.semanasCompletas = evalResult.completedWeeksCount;
      item.progresoTexto = evalResult.summaryText;
      item._order = orderIndex++;
      students.push(item);
    }
  }

  students.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    return a._order - b._order;
  });

  const cleanJsonList = [];
  if (instructorEntry) {
    cleanJsonList.push({
      github: instructorEntry.github,
      nombre: instructorEntry.nombre,
      rol: instructorEntry.rol,
      linkedin: instructorEntry.linkedin || '',
      redes: instructorEntry.redes || [],
      rango: instructorEntry.rango,
      motivacion: instructorEntry.motivacion
    });
  }
  for (const s of students) {
    cleanJsonList.push({
      github: s.github,
      nombre: s.nombre,
      rol: s.rol,
      linkedin: s.linkedin || '',
      redes: s.redes || [],
      rango: s.rango,
      puntos: s.puntos,
      motivacion: s.motivacion
    });
  }

  return {
    cleanJsonList,
    students,
    instructorEntry,
    officialChallenges
  };
}

function syncAllFiles(rawData) {
  const { cleanJsonList, students, instructorEntry, officialChallenges } = processAndSortData(rawData);
  fs.writeFileSync(JSON_PATH, JSON.stringify(cleanJsonList, null, 2) + '\n', 'utf8');
  const md = renderAsistentesMarkdown(students, instructorEntry, officialChallenges);
  fs.writeFileSync(MD_PATH, md, 'utf8');
  if (fs.existsSync(README_PATH)) {
    const readme = fs.readFileSync(README_PATH, 'utf8');
    fs.writeFileSync(README_PATH, updateReadmeWithMosaic(students, readme), 'utf8');
  }
  return { cleanJsonList, students, instructorEntry, officialChallenges };
}

if (require.main === module) {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const { students } = syncAllFiles(data);
  console.log(`✅ ASISTENTES.md y README.md actualizados y validados (${students.length} estudiantes).`);
}

module.exports = {
  INSTRUCTORS,
  CHALLENGE_VALIDATORS,
  cleanGithubUser,
  cleanLinkedin,
  parseExtraSocialLinks,
  discoverOfficialChallenges,
  evaluateUserProgress,
  processAndSortData,
  syncAllFiles,
  updateReadmeWithMosaic,
  renderAsistentesMarkdown
};
