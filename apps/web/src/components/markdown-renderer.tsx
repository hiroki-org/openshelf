"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import Image from "next/image";

type MarkdownRendererProps = {
  markdown: string;
  className?: string;
};

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
    a: [...(defaultSchema.attributes?.a || []), "target", "rel"],
    img: [...(defaultSchema.attributes?.img || []), "loading"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
};

export function MarkdownRenderer({
  markdown,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            />
          ),
          img: ({ node: _node, ...props }) => {
            const src = typeof props.src === "string" ? props.src : "";
            if (!src) {
              return (
                <img
                  src={src}
                  alt={props.alt ?? ""}
                  className="max-w-full rounded-md"
                />
              );
            }
            return (
              <Image
                src={src}
                alt={props.alt ?? ""}
                width={0}
                height={0}
                sizes="100vw"
                style={{ width: "100%", height: "auto" }}
                unoptimized
                className="max-w-full rounded-md"
              />
            );
          },
          code: ({ className, ...props }) => (
            <code
              className={`rounded bg-gray-100 px-1 py-0.5 font-mono text-sm dark:bg-gray-800 ${className ?? ""}`}
              {...props}
            />
          ),
          pre: ({ ...props }) => (
            <pre
              className="overflow-x-auto rounded-md bg-gray-950 p-3 text-sm text-gray-100"
              {...props}
            />
          ),
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table
                className="min-w-full border-collapse border border-gray-300 dark:border-gray-700"
                {...props}
              />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="border border-gray-300 px-2 py-1 text-left dark:border-gray-700"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td
              className="border border-gray-300 px-2 py-1 dark:border-gray-700"
              {...props}
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
