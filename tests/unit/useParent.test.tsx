import { describe, it, expect } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { useParent } from '../../src/hooks/useParent';
import { useVariable } from '../../src/hooks/useVariable';
import { MachineRegistry } from '../../src/registry/MachineRegistry';
import { useState } from 'react';

// Component that registers a parent and renders children
function ParentPanel({
  mode,
  showChild,
}: {
  mode: 'always' | 'onDemand';
  showChild: boolean;
}) {
  useParent('Motor', { mode });
  return showChild ? <SpeedChild /> : null;
}

function SpeedChild() {
  const [speed] = useVariable<number>('Motor.Speed');
  return <span data-testid="speed">{speed ?? 'none'}</span>;
}

// Wrapper to toggle child mount
function ToggleParent({ mode }: { mode: 'always' | 'onDemand' }) {
  const [show, setShow] = useState(true);
  return (
    <div>
      <ParentPanel mode={mode} showChild={show} />
      <button onClick={() => setShow(false)}>hide</button>
    </div>
  );
}

describe('useParent', () => {
  describe('always mode', () => {
    it('subscribes parent path even with no child hooks', async () => {
      const mock = new MockCommLayer();
      render(
        <MachineProvider id="p-always1" machine={mock}>
          <ParentPanel mode="always" showChild={false} />
        </MachineProvider>,
      );

      await act(async () => {});
      expect(mock.getSubscribedPaths()).toContain('Motor');
      MachineRegistry.unregisterMachine('p-always1');
    });

    it('unsubscribes parent when component unmounts', async () => {
      const mock = new MockCommLayer();
      const { unmount } = render(
        <MachineProvider id="p-always2" machine={mock}>
          <ParentPanel mode="always" showChild={false} />
        </MachineProvider>,
      );

      await act(async () => {});
      expect(mock.getSubscribedPaths()).toContain('Motor');

      await act(async () => { unmount(); });
      expect(mock.getSubscribedPaths()).not.toContain('Motor');
      MachineRegistry.unregisterMachine('p-always2');
    });
  });

  describe('onDemand mode', () => {
    it('subscribes parent when a child is mounted', async () => {
      const mock = new MockCommLayer();
      render(
        <MachineProvider id="p-od1" machine={mock}>
          <ParentPanel mode="onDemand" showChild={true} />
        </MachineProvider>,
      );

      await act(async () => {});
      expect(mock.getSubscribedPaths()).toContain('Motor');
      expect(mock.getSubscribedPaths()).not.toContain('Motor.Speed');
      MachineRegistry.unregisterMachine('p-od1');
    });

    it('does not subscribe parent when no child is mounted', async () => {
      const mock = new MockCommLayer();
      render(
        <MachineProvider id="p-od2" machine={mock}>
          <ParentPanel mode="onDemand" showChild={false} />
        </MachineProvider>,
      );

      await act(async () => {});
      expect(mock.getSubscribedPaths()).not.toContain('Motor');
      MachineRegistry.unregisterMachine('p-od2');
    });

    it('unsubscribes parent when last child unmounts', async () => {
      const mock = new MockCommLayer();
      render(
        <MachineProvider id="p-od3" machine={mock}>
          <ToggleParent mode="onDemand" />
        </MachineProvider>,
      );

      await act(async () => {});
      expect(mock.getSubscribedPaths()).toContain('Motor');

      await act(async () => {
        screen.getByText('hide').click();
      });

      await act(async () => {});
      expect(mock.getSubscribedPaths()).not.toContain('Motor');
      MachineRegistry.unregisterMachine('p-od3');
    });

    it('fan-out delivers child values to useVariable hooks', async () => {
      const mock = new MockCommLayer();
      render(
        <MachineProvider id="p-fanout" machine={mock}>
          <ParentPanel mode="onDemand" showChild={true} />
        </MachineProvider>,
      );

      await act(async () => {
        mock.setVariableValue('Motor', { Speed: 888, Temp: 60 });
      });

      await waitFor(() =>
        expect(screen.getByTestId('speed').textContent).toBe('888'),
      );
      MachineRegistry.unregisterMachine('p-fanout');
    });
  });
});
