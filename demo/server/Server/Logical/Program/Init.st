

PROGRAM _INIT
	(* ---- Motor / system defaults ---- *)
	HMIDemo.Status         := 'IDLE';
	HMIDemo.Speed          := 0.0;
	HMIDemo.Temp           := 22.0;
	HMIDemo.Pressure       := 0.0;
	HMIDemo.PressureTarget := 180.0;
	HMIDemo.Running        := FALSE;
	HMIDemo.Heartbeat      := FALSE;
	HMIDemo.Cycles         := 0;

	(* ---- Settings defaults ---- *)
	HMIDemo.Settings.SpeedLimit             := 2500.0;
	HMIDemo.Settings.TempWarnThreshold      := 60.0;
	HMIDemo.Settings.PressureWarnThreshold  := 160.0;
	HMIDemo.Settings.AutoStopOnAlarm        := FALSE;

	(* ---- Recipe presets ---- *)
	HMIDemo.Recipes.LoadedIndex := 0;

	HMIDemo.Recipes.Slots[0].Name           := 'Slow';
	HMIDemo.Recipes.Slots[0].Setpoint       := 500.0;
	HMIDemo.Recipes.Slots[0].PressureTarget := 80.0;

	HMIDemo.Recipes.Slots[1].Name           := 'Medium';
	HMIDemo.Recipes.Slots[1].Setpoint       := 1500.0;
	HMIDemo.Recipes.Slots[1].PressureTarget := 120.0;

	HMIDemo.Recipes.Slots[2].Name           := 'Fast';
	HMIDemo.Recipes.Slots[2].Setpoint       := 2500.0;
	HMIDemo.Recipes.Slots[2].PressureTarget := 160.0;

	HMIDemo.Recipes.Slots[3].Name           := 'Custom';
	HMIDemo.Recipes.Slots[3].Setpoint       := 0.0;
	HMIDemo.Recipes.Slots[3].PressureTarget := 0.0;
END_PROGRAM