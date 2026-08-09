import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ActionItemSidebar from './ActionItemSidebar';

function renderSidebar({
  open = true,
  isLoading = false,
  children,
}: {
  open?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
} = {}) {
  return renderToStaticMarkup(
    <ActionItemSidebar
      open={open}
      isLoading={isLoading}
      onCollapse={() => undefined}
      onExpand={() => undefined}
    >
      {children}
    </ActionItemSidebar>,
  );
}

test('renders the listening sidebar shell and empty state', () => {
  const markup = renderSidebar();

  assert.match(markup, />Action items</);
  assert.match(markup, />Listening</);
  assert.match(markup, /aria-label="Collapse action items"/);
  assert.match(markup, /No new action items yet/);
});

test('shows the checking state while loading', () => {
  const markup = renderSidebar({ isLoading: true });

  assert.match(markup, />Checking</);
  assert.doesNotMatch(markup, />Listening</);
});

test('renders supplied content instead of the empty state', () => {
  const markup = renderSidebar({ children: <p>Suggested action item</p> });

  assert.match(markup, /Suggested action item/);
  assert.doesNotMatch(markup, /No new action items yet/);
});

test('hides the sidebar from assistive technology when collapsed', () => {
  const markup = renderSidebar({ open: false });

  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /data-open="false"/);
  assert.match(markup, /aria-label="Open action items"/);
});
