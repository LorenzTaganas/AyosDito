import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('shows the visible range and page state', () => {
    render(<Pagination page={2} pageSize={10} total={25} totalPages={3} onPageChange={() => {}} />);

    expect(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('requests the previous and next pages', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={10} total={25} totalPages={3} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('disables navigation at the edges', () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={10} total={10} totalPages={2} onPageChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    rerender(<Pagination page={2} pageSize={10} total={10} totalPages={2} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('renders nothing when there are no records', () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} total={0} totalPages={0} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
