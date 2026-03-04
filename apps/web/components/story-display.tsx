export default function StoryDisplay({ story }: { story: string }) {
  return (
    <div className="flex-1 min-h-0">
      <h3 className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2 shrink-0">
        香りのストーリー
      </h3>
      <div className="text-[12px] text-gray-600 leading-relaxed">
        {story
          .split("\n")
          .filter(Boolean)
          .map((paragraph, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: split paragraphs have no stable ID
            <p key={i} className={i > 0 ? "mt-3" : ""}>
              {paragraph}
            </p>
          ))}
      </div>
    </div>
  );
}
