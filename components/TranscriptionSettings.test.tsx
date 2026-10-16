/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import TranscriptionSettings, {
  defaultCaptionSettings,
} from './TranscriptionSettings';

test('shows an identifiable custom colour picker and applies its selection', () => {
  const onChange = jest.fn();
  render(
    <TranscriptionSettings
      settings={defaultCaptionSettings}
      onChange={onChange}
      open
      onClose={jest.fn()}
    />,
  );

  expect(screen.queryByText('Custom colour')).toBeNull();
  const picker = screen.getByLabelText('Choose custom caption colour');
  expect(picker).toHaveValue('#ff0000');
  fireEvent.change(picker, {
    target: { value: '#00ff00' },
  });
  expect(onChange).toHaveBeenCalledWith({
    ...defaultCaptionSettings,
    textColor: '#00ff00',
  });
  expect(picker).toHaveValue('#00ff00');
});
