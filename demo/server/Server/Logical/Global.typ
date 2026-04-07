(*
     * HMIDemo types
     *
     * Shared state between the HMIDemo PLC task and the lux-react demo HMI.
     * All fields are accessible as OPC UA nodes under the variable name 'HMIDemo'.
     *
     * Example OPC UA paths:
     *   HMIDemo.Power                  — written by HMI
     *   HMIDemo.Speed                  — read by HMI
     *   HMIDemo.Settings.SpeedLimit    — read/write
     *   HMIDemo.Recipes.Slots[0].Name  — read
     *   HMIDemo.Alarms.TempHigh        — read
     *)

TYPE
	HMIDemo_Settings_typ : STRUCT
		SpeedLimit : REAL; (* Maximum allowed speed (RPM)       *)
		TempWarnThreshold : REAL; (* Temperature warning level (°C)    *)
		PressureWarnThreshold : REAL; (* Pressure warning level (bar)      *)
		AutoStopOnAlarm : BOOL; (* Auto-stop motor when alarm active *)
	END_STRUCT;

	HMIDemo_Recipe_typ : STRUCT
		Name : STRING[40]; (* Recipe display name               *)
		Setpoint : REAL; (* Speed setpoint (RPM)              *)
		PressureTarget : REAL; (* Target pressure (bar)             *)
	END_STRUCT;

	HMIDemo_Recipes_typ : STRUCT
		ActiveIndex : USINT; (* Recipe index to load (0..3)       *)
		Load : BOOL; (* HMI sets TRUE to load recipe      *)
		LoadedIndex : USINT; (* Currently loaded recipe index     *)
		Slots : ARRAY[0..3] OF HMIDemo_Recipe_typ;
	END_STRUCT;

	HMIDemo_Alarms_typ : STRUCT
		TempHigh : BOOL; (* Temperature above threshold       *)
		PressureHigh : BOOL; (* Pressure above threshold          *)
		SpeedFault : BOOL; (* Speed exceeds limit               *)
		AnyActive : BOOL; (* OR of all alarm conditions        *)
		AckAll : BOOL; (* HMI sets TRUE to acknowledge      *)
	END_STRUCT;

	HMIDemo_typ : STRUCT
		(* ---- Commands (HMI -> PLC) ---- *)
		Power : BOOL; (* TRUE = run, FALSE = stop          *)
		Setpoint : REAL; (* Speed setpoint (RPM)              *)
		PressureTarget : REAL; (* Pressure target (bar)             *)
		(* ---- Status  (PLC -> HMI) ---- *)
		Speed : REAL; (* Actual motor speed (RPM)          *)
		Temp : REAL; (* Motor temperature (°C)            *)
		Running : BOOL; (* Motor is running                  *)
		Pressure : REAL; (* Hydraulic pressure (bar)          *)
		Status : STRING[80]; (* Status text                       *)
		Heartbeat : BOOL; (* Toggled by PLC every 500 ms       *)
		Cycles : UDINT; (* Cycle counter                     *)
		(* ---- Sub-structures ---- *)
		Settings : HMIDemo_Settings_typ;
		Recipes : HMIDemo_Recipes_typ;
		Alarms : HMIDemo_Alarms_typ;
	END_STRUCT;
END_TYPE
