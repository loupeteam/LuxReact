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
  const [name] = useVariable<string>('Name', { defaultValue: '---' });
  const [setpoint] = useVariable<number>('Setpoint', { defaultValue: 0 });
  const [pressureTarget] = useVariable<number>('PressureTarget', {
    defaultValue: 0,
  });

  return (
    <div className={`card recipe-card${isLoaded ? ' recipe-card--active' : ''}`}>
      <div className="recipe-header">
        <span className="recipe-name">{name ?? '---'}</span>
        {isLoaded && <span className="recipe-loaded-badge">LOADED</span>}
      </div>
      <div className="recipe-params">
        <div className="recipe-param">
          <span className="recipe-param-label">Speed</span>
          <span className="recipe-param-value">{setpoint ?? 0} RPM</span>
        </div>
        <div className="recipe-param">
          <span className="recipe-param-label">Pressure</span>
          <span className="recipe-param-value">{pressureTarget ?? 0} bar</span>
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
