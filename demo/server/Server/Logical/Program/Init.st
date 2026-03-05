

PROGRAM _INIT
	HMIDemo.Status    := 'IDLE';
	HMIDemo.Speed     := 0.0;
	HMIDemo.Temp      := 22.0;
	HMIDemo.Pressure  := 0.0;
	HMIDemo.Running   := FALSE;
	HMIDemo.Heartbeat := FALSE;
	HMIDemo.Cycles    := 0;	 
END_PROGRAM