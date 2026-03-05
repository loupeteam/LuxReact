
PROGRAM _CYCLIC

(* ------------------------------------------------------------------ *)
(*  HMIDemoTask — CYCLIC                                              *)
(*  Default task class: #Cyclic, recommended cycle time: 100ms.       *)
(* ------------------------------------------------------------------ *)

(* 1. Heartbeat — toggle every 500 ms -------------------------------- *)
	tHeartbeat(IN := NOT tHeartbeat.Q, PT := T#500ms);
	IF tHeartbeat.Q THEN
		HMIDemo.Heartbeat := NOT HMIDemo.Heartbeat;
	END_IF

(* 2. Motor speed — ramp toward setpoint when powered,
      ramp to zero when stopped ---------------------------------------- *)
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

	(* 3. Motor temperature — asymptotes toward 22 + (speed * 0.06) ------ *)
	HMIDemo.Temp := 22.0 + (HMIDemo.Speed * 0.06);

	(* 4. Hydraulic pressure — builds when running, bleeds when stopped --- *)
	IF HMIDemo.Running THEN
		HMIDemo.Pressure := MIN(HMIDemo.Pressure + 10.0, 180.0);
	ELSE
		HMIDemo.Pressure := MAX(HMIDemo.Pressure - 5.0, 0.0);
	END_IF

	(* 5. Cycle counter — increment every 2 s while running --------------- *)
	(*    Pattern: IN := Running AND NOT Q restarts timer automatically.   *)
	tCycle(IN := HMIDemo.Running AND NOT tCycle.Q, PT := T#2s);
	IF tCycle.Q THEN
		HMIDemo.Cycles := HMIDemo.Cycles + 1;
	END_IF

	(* 6. Status text ----------------------------------------------------- *)
	IF HMIDemo.Running THEN
		HMIDemo.Status := 'RUNNING';
	ELSIF HMIDemo.Speed > 0.0 THEN
		HMIDemo.Status := 'STOPPING';
	ELSIF HMIDemo.Power THEN
		HMIDemo.Status := 'STARTING';
	ELSE
		HMIDemo.Status := 'IDLE';
	END_IF
END_PROGRAM
