import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VariableScope } from '../../src/provider/VariableScope';
import { VariableScopeContext, useVariablePrefix, resolvePath } from '../../src/context/VariableScopeContext';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { MockCommLayer } from '../../src/mock/MockCommLayer';

function PrefixCapture({ onCapture }: { onCapture: (p: string) => void }) {
  const prefix = useVariablePrefix();
  onCapture(prefix);
  return null;
}

describe('resolvePath', () => {
  it('returns path unchanged when prefix is empty', () => {
    expect(resolvePath('Motor.Speed', '')).toBe('Motor.Speed');
  });

  it('joins prefix and path with dot', () => {
    expect(resolvePath('Speed', 'Motor')).toBe('Motor.Speed');
  });

  it('returns prefix when path is empty', () => {
    expect(resolvePath('', 'Motor')).toBe('Motor');
  });
});

describe('VariableScope', () => {
  it('sets a prefix in context', () => {
    let captured = '';
    render(
      <VariableScope prefix="Motor">
        <PrefixCapture onCapture={(p) => { captured = p; }} />
      </VariableScope>,
    );
    expect(captured).toBe('Motor');
  });

  it('stacks prefixes from nested scopes', () => {
    let captured = '';
    render(
      <VariableScope prefix="Motor">
        <VariableScope prefix="Axis[0]">
          <PrefixCapture onCapture={(p) => { captured = p; }} />
        </VariableScope>
      </VariableScope>,
    );
    expect(captured).toBe('Motor.Axis[0]');
  });

  it('combines MachineProvider variablePrefix with nested VariableScope', () => {
    let captured = '';
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="test-scope" machine={mock} variablePrefix="::AsGlobalPV:">
        <VariableScope prefix="Motor">
          <PrefixCapture onCapture={(p) => { captured = p; }} />
        </VariableScope>
      </MachineProvider>,
    );
    expect(captured).toBe('::AsGlobalPV:.Motor');
  });

  it('deeply nested VariableScope stacks all levels', () => {
    let captured = '';
    render(
      <VariableScopeContext.Provider value="Root">
        <VariableScope prefix="Motor">
          <VariableScope prefix="Axis[0]">
            <PrefixCapture onCapture={(p) => { captured = p; }} />
          </VariableScope>
        </VariableScope>
      </VariableScopeContext.Provider>,
    );
    expect(captured).toBe('Root.Motor.Axis[0]');
  });
});
