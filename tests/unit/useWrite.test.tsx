import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { VariableScope } from '../../src/provider/VariableScope';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { useWrite } from '../../src/hooks/useWrite';
import { MachineRegistry } from '../../src/registry/MachineRegistry';

function WriteButton({
  path,
  value,
  onWrite,
}: {
  path: string;
  value: unknown;
  onWrite?: () => void;
}) {
  const write = useWrite(path);
  return (
    <button
      onClick={async () => {
        await write(value);
        onWrite?.();
      }}
    >
      write
    </button>
  );
}

describe('useWrite', () => {
  it('calls writeVariable when invoked', async () => {
    const mock = new MockCommLayer();
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    const { getByText } = render(
      <MachineProvider id="w-test1" machine={mock}>
        <WriteButton path="Safety.EStop" value={true} />
      </MachineProvider>,
    );

    await act(async () => {
      getByText('write').click();
    });

    expect(writeSpy).toHaveBeenCalledWith('Safety.EStop', true);
    MachineRegistry.unregisterMachine('w-test1');
  });

  it('creates no subscription', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="w-test2" machine={mock}>
        <WriteButton path="Safety.EStop" value={true} />
      </MachineProvider>,
    );

    // Flush microtasks — no subscription should have been created
    await act(async () => {});
    expect(mock.getSubscribedPaths()).toEqual([]);
    MachineRegistry.unregisterMachine('w-test2');
  });

  it('resolves path through VariableScope', async () => {
    const mock = new MockCommLayer();
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    const { getByText } = render(
      <MachineProvider id="w-scope" machine={mock}>
        <VariableScope prefix="Safety">
          <WriteButton path="EStop" value={true} />
        </VariableScope>
      </MachineProvider>,
    );

    await act(async () => {
      getByText('write').click();
    });

    expect(writeSpy).toHaveBeenCalledWith('Safety.EStop', true);
    MachineRegistry.unregisterMachine('w-scope');
  });
});
