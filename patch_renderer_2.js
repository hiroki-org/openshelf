const fs = require('fs');
const path = 'apps/web/src/components/markdown-renderer.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `            const src = typeof props.src === "string" ? props.src : "";
            if (!src) {
              return (
                <img
                  src={src}
                  alt={props.alt ?? ""}
                  className="max-w-full rounded-md"
                />
              );
            }`,
  `            const src = typeof props.src === "string" ? props.src : "";
            if (!src) {
              return (
                <img
                  alt={props.alt ?? ""}
                  className="max-w-full rounded-md"
                />
              );
            }`
);

fs.writeFileSync(path, content);
