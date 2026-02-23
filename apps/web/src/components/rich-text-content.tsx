type RichTextContentProps = {
  html: string;
  className?: string;
};

export function RichTextContent({ html, className }: RichTextContentProps) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
