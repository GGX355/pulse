import postcss from 'postcss';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const source = execFileSync('git', ['show', 'origin/dev:src/styles.css'], { encoding: 'utf8' });
const tree = postcss.parse(source);
tree.walkAtRules('import', rule => rule.remove());
tree.walkRules(rule => {
  let parent = rule.parent;
  while (parent) { if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return; parent = parent.parent; }
  rule.selector = postcss.list.comma(rule.selector).map(selector => {
    if (selector.includes(':root')) return selector.replaceAll(':root', '.pulse-business-host');
    return `.pulse-business-host ${selector.replace(/^(html|body)(?=[\s.[:]|$)/, ':scope')}`;
  }).join(',\n');
});
await writeFile('../liquid-glass-template/pulse-final/pulse-feature-layout.css', '/* Functional layout/animation styles from GGX355/pulse dev, scoped to original route content. */\n' + tree.toString());
console.log('Preserved dev feature layout and draw animation styles with scoped selectors.');
