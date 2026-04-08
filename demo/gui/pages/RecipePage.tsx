import { useVariable, useWrite, VariableScope } from 'lux-react';
import { PageHeader } from '../components/PageHeader';

export function RecipePage() {
  const [loadedIndex] = useVariable<number>('HMIDemo.Recipes.LoadedIndex', {
    defaultValue: 0,
  });
  const writeActiveIndex = useWrite<number>('HMIDemo.Recipes.ActiveIndex');
  const writeLoad = useWrite<boolean>('HMIDemo.Recipes.Load');

  async function loadRecipe(index: number) {
    await writeActiveIndex(index);
    await writeLoad(true);
  }

  return (
    <div className="page">
      <PageHeader title="Recipes" description="Preset machine configurations" />

      <div className="recipe-grid">
        {[0, 1, 2, 3].map((i) => (
          <RecipeCard
            key={i}
            index={i}
            isLoaded={(loadedIndex ?? 0) === i}
            onLoad={() => void loadRecipe(i)}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Recipe card ---------------------------------------------------

function RecipeCard({
  index,
  isLoaded,
  onLoad,
}: {
  index: number;
  isLoaded: boolean;
  onLoad: () => void;
}) {
  return (
    <VariableScope prefix={`HMIDemo.Recipes.Slots[${index}]`}>
      <RecipeCardContent isLoaded={isLoaded} onLoad={onLoad} />
    </VariableScope>
  );
}

function RecipeCardContent({
  isLoaded,
  onLoad,
}: {
  isLoaded: boolean;
  onLoad: () => void;
}) {
  const [name, setName] = useVariable<string>('Name', {
    defaultValue: '',
    optimistic: true,
  });
  const [setpoint, setSetpoint] = useVariable<number>('Setpoint', {
    defaultValue: 0,
    optimistic: true,
  });
  const [pressureTarget, setPressureTarget] = useVariable<number>('PressureTarget', {
    defaultValue: 0,
    optimistic: true,
  });

  return (
    <div className={`card recipe-card${isLoaded ? ' recipe-card--active' : ''}`}>
      <div className="recipe-header">
        <input
          className="recipe-name-input"
          type="text"
          value={name ?? ''}
          onChange={(e) => void setName(e.target.value)}
          placeholder="Recipe name"
          aria-label="Recipe Name"
        />
        {isLoaded && <span className="recipe-loaded-badge">LOADED</span>}
      </div>
      <div className="recipe-params">
        <div className="recipe-param">
          <span className="recipe-param-label">Speed</span>
          <div className="recipe-param-input-wrap">
            <input
              className="recipe-param-input"
              type="number"
              value={setpoint ?? 0}
              onChange={(e) => void setSetpoint(Number(e.target.value) || 0)}
              step={10}
              min={0}
              aria-label="Recipe Speed"
            />
            <span className="recipe-param-unit">RPM</span>
          </div>
        </div>
        <div className="recipe-param">
          <span className="recipe-param-label">Pressure</span>
          <div className="recipe-param-input-wrap">
            <input
              className="recipe-param-input"
              type="number"
              value={pressureTarget ?? 0}
              onChange={(e) => void setPressureTarget(Number(e.target.value) || 0)}
              step={1}
              min={0}
              aria-label="Recipe Pressure"
            />
            <span className="recipe-param-unit">bar</span>
          </div>
        </div>
      </div>
      <button
        className={`recipe-btn${isLoaded ? ' recipe-btn--loaded' : ''}`}
        onClick={onLoad}
        disabled={isLoaded}
      >
        {isLoaded ? 'Active' : 'Load Recipe'}
      </button>
    </div>
  );
}
