import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines: string[]): string {
  const contentLines = ["BT", "/F1 11 Tf", "50 750 Td", "14 TL"];
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      contentLines.push(`(${escapePdfText(lines[i])}) Tj`);
    } else {
      contentLines.push("T*");
      contentLines.push(`(${escapePdfText(lines[i])}) Tj`);
    }
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return pdf;
}

const outDir = join(process.cwd(), "samples");
mkdirSync(outDir, { recursive: true });

const jd = `Frontend Engineer

We are hiring a Frontend Engineer.

Requirements / Qualifications:
- Strong experience with React and TypeScript
- Experience with Next.js
- Familiar with CSS and responsive design
- Comfortable with Git and code review
- Plus: GraphQL, Jest, and CI/CD experience
`;

const fullstackJd = `Full-Stack Software Developer

Required skills: Java, Spring Boot, React, TypeScript, JavaScript, REST APIs, JWT, PostgreSQL, Redis, Docker, CI/CD, JUnit, Mockito, and cross-functional teamwork.

Preferred skills: Kubernetes, GraphQL, and React Native.
`;

const cvs: Record<string, string[]> = {
  "cv-strong-frontend.pdf": [
    "Alya Pratama - Frontend Engineer",
    "Email: alya.pratama@example.com",
    "",
    "Summary",
    "Frontend engineer with 4 years building web apps.",
    "",
    "Skills",
    "React, TypeScript, Next.js, CSS, Git, GraphQL, Jest, CI/CD",
    "",
    "Experience",
    "Senior Frontend Developer - Nova Labs (2022-Present)",
    "- Built React and TypeScript features for customer dashboard",
    "- Migrated marketing site to Next.js",
    "- Wrote Jest tests and improved CI/CD pipeline",
    "- Used GraphQL APIs and Git code review workflow",
    "",
    "Education",
    "B.Sc. Computer Science",
  ],
  "cv-medium-frontend.pdf": [
    "Bima Santoso - Web Developer",
    "Email: bima.santoso@example.com",
    "",
    "Summary",
    "Web developer focused on UI implementation.",
    "",
    "Skills",
    "React, TypeScript, CSS, Git, HTML, JavaScript",
    "",
    "Experience",
    "Frontend Developer - Pixel Studio (2021-Present)",
    "- Built React components with TypeScript",
    "- Styled responsive pages with CSS",
    "- Collaborated using Git pull requests",
    "",
    "Education",
    "Diploma in Information Technology",
  ],
  "cv-fullstack-strong.pdf": [
    "Dimas Wijaya - Senior Full-Stack Developer",
    "Email: dimas.wijaya@example.com",
    "",
    "Summary",
    "Senior full-stack developer with 5 years building production enterprise systems.",
    "",
    "Skills",
    "Java, Spring Boot, React, TypeScript, REST APIs, JWT, PostgreSQL, Redis,",
    "Docker, CI/CD, JUnit, Mockito, Kubernetes, GraphQL, React Native",
    "",
    "Experience",
    "Senior Full-Stack Developer - FintechHub (2021-Present)",
    "- Built Java Spring Boot services and secure REST APIs with JWT and RBAC",
    "- Delivered React and TypeScript dashboards for business users",
    "- Tuned PostgreSQL queries and used Redis for application caching",
    "- Wrote JUnit and Mockito tests and maintained Docker CI/CD pipelines",
    "- Collaborated with product, QA, and platform teams",
    "- Operated Kubernetes workloads in production",
    "",
    "Education",
    "B.Sc. Computer Science",
  ],
  "cv-fullstack-medium.pdf": [
    "Nadia Putri - Full-Stack Developer",
    "Email: nadia.putri@example.com",
    "",
    "Summary",
    "Full-stack developer with 3 years of experience building internal web applications.",
    "",
    "Skills",
    "Java, Spring Boot, React, TypeScript, REST APIs, PostgreSQL, Docker, JUnit, Git",
    "",
    "Experience",
    "Full-Stack Developer - RetailWorks (2022-Present)",
    "- Developed Spring Boot REST APIs and React TypeScript interfaces",
    "- Worked with PostgreSQL and wrote JUnit tests",
    "- Used Docker in local development and GitHub Actions for CI",
    "- Collaborated with a small product team",
    "",
    "Education",
    "B.Sc. Information Systems",
  ],
  "cv-fullstack-transition.pdf": [
    "Raka Pratama - Software Engineer",
    "Email: raka.pratama@example.com",
    "",
    "Summary",
    "Software engineer with backend and frontend project experience.",
    "",
    "Skills",
    "Node.js, JavaScript, React, MongoDB, Express, Docker, Git, GraphQL",
    "",
    "Experience",
    "Software Engineer - CodeCraft (2023-Present)",
    "- Built React JavaScript interfaces and Node.js APIs",
    "- Used MongoDB and GraphQL for product features",
    "- Containerized services with Docker",
    "- Participated in code reviews with the engineering team",
    "",
    "Education",
    "B.Sc. Information Technology",
  ],  "cv-weak-frontend.pdf": [
    "Citra Wulandari - Backend Engineer",
    "Email: citra.wulandari@example.com",
    "",
    "Summary",
    "Backend engineer focused on APIs and databases.",
    "",
    "Skills",
    "Node.js, PostgreSQL, Docker, Redis, Kafka, Terraform",
    "",
    "Experience",
    "Backend Engineer - DataForge (2020-Present)",
    "- Designed REST APIs with Node.js",
    "- Operated PostgreSQL and Redis services",
    "- Deployed services with Docker and Terraform",
    "",
    "Education",
    "B.Eng. Informatics",
  ],
};

writeFileSync(join(outDir, "jd-frontend.txt"), jd, "utf8");
writeFileSync(join(outDir, "jd-fullstack.txt"), fullstackJd, "utf8");
for (const [name, lines] of Object.entries(cvs)) {
  writeFileSync(join(outDir, name), buildPdf(lines), "utf8");
}

console.log("Wrote samples to", outDir);
