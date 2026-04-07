
PROGRAM _CYCLIC

(* ------------------------------------------------------------------ *)
(*  HMIDemoTask  CYCLIC                                               *)
(*  Default task class: #Cyclic, recommended cycle time: 100ms.       *)
(* ------------------------------------------------------------------ *)

(* 1. Heartbeat  toggle every 500 ms -------------------------------- *)
	tHeartbeat(IN := NOT tHeartbeat.Q, PT := T#500ms);
	IF tHeartbeat.Q THEN
		HMIDemo.Heartbeat := NOT HMIDemo.Heartbeat;
	END_IF

(* 2. Clamp setpoint to speed limit --------------------------------- *)
	IF HMIDemo.Setpoint > HMIDemo.Settings.SpeedLimit THEN
		HMIDemo.Setpoint := HMIDemo.Settings.SpeedLimit;
	END_IF

(* 3. Motor speed  ramp toward setpoint when powered,
      ramp to zero when stopped -------------------------------------- *)
	IF HMIDemo.Power THEN
		IF HMIDemo.Speed < HMIDemo.Setpoint THEN
			HMIDemo.Speed := MIN(HMIDemo.Speed + 50.0, HMIDemo.Setpoint);
		ELSIF HMIDemo.Speed > HMIDemo.Setpoint THEN
			HMIDemo.Speed := MAX(HMIDemo.Speed - 50.0, HMIDemo.Setpoint);
		END_IF
	ELSE
		HMIDemo.Speed := MAX(HMIDemo.Speed - 80.0, 0.0);
	END_IF

	HMIDemo.Running := HMIDemo.Speed > 10.0;

(* 4. Motor temperature  22 + (speed * 0.06) ------------------------ *)
	HMIDemo.Temp := 22.0 + (HMIDemo.Speed * 0.06);

(* 5. Hydraulic pressure  builds toward target when running ---------- *)
	IF HMIDemo.Running THEN
		HMIDemo.Pressure := MIN(HMIDemo.Pressure + 10.0, HMIDemo.PressureTarget);
	ELSE
		HMIDemo.Pressure := MAX(HMIDemo.Pressure - 5.0, 0.0);
	END_IF

(* 6. Cycle counter  increment every 2 s while running --------------- *)
	tCycle(IN := HMIDemo.Running AND NOT tCycle.Q, PT := T#2s);
	IF tCycle.Q THEN
		HMIDemo.Cycles := HMIDemo.Cycles + 1;
	END_IF

(* 7. Status text ---------------------------------------------------- *)
	IF HMIDemo.Running THEN
		HMIDemo.Status := 'RUNNING';
	ELSIF HMIDemo.Speed > 0.0 THEN
		HMIDemo.Status := 'STOPPING';
	ELSIF HMIDemo.Power THEN
		HMIDemo.Status := 'STARTING';
	ELSE
		HMIDemo.Status := 'IDLE';
	END_IF

(* 8. Recipe loading ------------------------------------------------- *)
	IF HMIDemo.Recipes.Load THEN
		HMIDemo.Setpoint       := HMIDemo.Recipes.Slots[HMIDemo.Recipes.ActiveIndex].Setpoint;
		HMIDemo.PressureTarget := HMIDemo.Recipes.Slots[HMIDemo.Recipes.ActiveIndex].PressureTarget;
		HMIDemo.Recipes.LoadedIndex := HMIDemo.Recipes.ActiveIndex;
		HMIDemo.Recipes.Load   := FALSE;
	END_IF

(* 9. Alarm evaluation ----------------------------------------------- *)
	HMIDemo.Alarms.TempHigh     := HMIDemo.Temp     > HMIDemo.Settings.TempWarnThreshold;
	HMIDemo.Alarms.PressureHigh := HMIDemo.Pressure  > HMIDemo.Settings.PressureWarnThreshold;
	HMIDemo.Alarms.SpeedFault   := HMIDemo.Speed     > HMIDemo.Settings.SpeedLimit;
	HMIDemo.Alarms.AnyActive    := HMIDemo.Alarms.TempHigh
	                             OR HMIDemo.Alarms.PressureHigh
	                             OR HMIDemo.Alarms.SpeedFault;

(* 10. Auto-stop on alarm -------------------------------------------- *)
	IF HMIDemo.Settings.AutoStopOnAlarm AND HMIDemo.Alarms.AnyActive THEN
		HMIDemo.Power := FALSE;
	END_IF

(* 11. Acknowledge reset --------------------------------------------- *)
	IF HMIDemo.Alarms.AckAll THEN
		HMIDemo.Alarms.AckAll := FALSE;
	END_IF

END_PROGRAM
