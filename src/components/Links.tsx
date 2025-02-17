import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface LinksProps {
  links: Links[];
}

export default function Links(props: LinksProps) {
  const [copiedStates, setCopiedStates] = useState<{ [key: number]: boolean }>(
    {},
  );

  const colors = [
    "bg-blue-100",
    "bg-red-100",
    "bg-green-100",
    "bg-yellow-100",
    "bg-purple-100",
    "bg-pink-100",
  ];

  useEffect(() => {
    Object.entries(copiedStates).forEach(([index, isCopied]) => {
      if (isCopied) {
        setTimeout(() => {
          setCopiedStates((prev) => ({
            ...prev,
            [index]: false,
          }));
        }, 2000);
      }
    });
  }, [copiedStates]);

  return (
    <div className="grid lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-1 gap-4">
      {props.links.map((link, index) => (
        <motion.a
          className={`text-center text-2xl font-bold ${colors[index % colors.length]} px-5 py-3 border-2 rounded-md transition-shadow duration-300 shadow-[0_2px_0_2px_rgba(0,0,0,1)] hover:shadow-[0_0_0px_rgba(0,0,0,0.5)]`}
          whileHover={{
            scale: 0.95,
          }}
          transition={{ type: "spring", damping: 15 }}
          key={index}
          href={link.url ? link.url : null}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (link.clipboard) {
              navigator.clipboard.writeText(link.clipboard);
              setCopiedStates((prev) => ({
                ...prev,
                [index]: true,
              }));
            }
          }}
        >
          {link.clipboard ? (
            copiedStates[index] ? (
              <span className="text-green-700">Copied!</span>
            ) : (
              <span>{link.title}</span>
            )
          ) : (
            <span>{link.title}</span>
          )}
        </motion.a>
      ))}
    </div>
  );
}
