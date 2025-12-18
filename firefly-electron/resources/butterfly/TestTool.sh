#!/bin/sh

export PATH_LIB=./lib
export PATH_AXIS=%PATH_LIB%/axis-1.4export PATH_BORLAND=%PATH_LIB%/borland

export CLASSPATH_AXIS=%PATH_AXIS%/axis.jar:%PATH_AXIS%/axis-ant.jar:%PATH_AXIS%/jaxrpc.jar:%PATH_AXIS%/saaj.jar:%PATH_AXIS%/wsdl4j-1.5.1.jar

export CLASSPATH_APP=%PATH_LIB%/jdom.jar:%PATH_LIB%\Serialio.jar:%PATH_LIB%/ant-1.5.jar:%PATH_LIB%/commons-codec-1.3.jar:%PATH_LIB%/commons-discovery-0.2.jar:%PATH_LIB%/commons-httpclient-3.0-rc3.jar:%PATH_LIB%/commons-lang-2.0.jar:%PATH_LIB%/commons-logging-1.0.4.jar:%PATH_LIB%/cryptix32.jar:%PATH_LIB%/log4j-1.2.14.jar:%PATH_LIB%/Butterfly.jar

export CLASSPATH_BORLAND=%PATH_BORLAND%/jbcl.jar

/usr/lib/jvm/java-1.5.0-sun/bin/java -classpath "%CLASSPATH_AXIS%:%CLASSPATH_APP%:%CLASSPATH_BORLAND%" com.cccint.test.testtool.general.Main 
