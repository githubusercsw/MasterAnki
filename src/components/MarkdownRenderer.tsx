/**
 * MarkdownRenderer
 *
 * 卡片内容 Markdown 渲染：
 * - 表格（remark-gfm）
 * - 数学公式（remark-math + rehype-katex）
 * - 代码高亮（rehype-highlight）
 * - 链接/图片默认行为
 *
 * 纯展示组件，不依赖环境。
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';

export interface MarkdownRendererProps {
  content: string;
  /** 是否压缩空白（预览卡片时常用） */
  compact?: boolean;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  compact = false,
  className,
}) => {
  return (
    <div
      className={`ma-markdown${compact ? ' ma-markdown-compact' : ''}${className ? ` ${className}` : ''}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          img: ({ node, ...props }) => (
            <img {...props} style={{ maxWidth: '100%', borderRadius: 6 }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
