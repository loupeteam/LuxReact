(*
     * HMIDemo_typ
     *
     * Shared state between the HMIDemo PLC task and the lux-react demo HMI.
     * All fields are accessible as OPC UA nodes under the variable name 'HMIDemo'.
     *
     * Example OPC UA paths (with your project's namespace configured):
     *   HMIDemo.Power      — written by HMI
     *   HMIDemo.Speed      — read by HMI
     *)

TYPE
	HMIDemo_typ : 	STRUCT  (* ---- Commands (HMI → PLC) -------------------------------- *)
		Setpoint : REAL; (* Speed setpoint (RPM)              *) (* ---- Status (PLC → HMI) ---------------------------------- *)
		Speed : REAL; (* Actual motor speed (RPM)          *)
		Temp : REAL; (* Motor temperature (°C)            *)
		Running : BOOL; (* Motor is running                  *)
		Pressure : REAL; (* Hydraulic pressure (bar)          *)
		Status : STRING[80]; (* Status text                       *)
		Heartbeat : BOOL; (* Toggled by PLC every 500 ms       *)
		Cycles : UDINT; (* Cycle counter                     *)
		Power : BOOL; (* TRUE = run command, FALSE = stop  *)
	END_STRUCT;
END_TYPE
