set PATH_LIB=.\lib

set PATH_AXIS=%PATH_LIB%\axis-1.4
set PATH_BORLAND=%PATH_LIB%\borland
set PATH_TOMCAT=%PATH_LIB%\apache-tomcat-5.5.27-embed\lib

set CLASSPATH_AXIS=%PATH_AXIS%\axis.jar;%PATH_AXIS%\axis-ant.jar;%PATH_AXIS%\jaxrpc.jar;%PATH_AXIS%\saaj.jar;%PATH_AXIS%\wsdl4j-1.5.1.jar
set CLASSPATH_APP=%PATH_LIB%\jdom.jar;%PATH_LIB%\jssc.jar;%PATH_LIB%\json-20190722.jar;%PATH_LIB%\Serialio.jar;%PATH_LIB%\ant-1.5.jar;%PATH_LIB%\commons-codec-1.3.jar;%PATH_LIB%\commons-discovery-0.2.jar;%PATH_LIB%\commons-httpclient-3.0-rc3.jar;%PATH_LIB%\commons-lang-2.0.jar;%PATH_LIB%\commons-logging-1.0.4.jar;%PATH_LIB%\cryptix32.jar;%PATH_LIB%\log4j-1.2.14.jar;%PATH_LIB%\Butterfly.jar
set CLASSPATH_BORLAND=%PATH_BORLAND%\jbcl.jar

set CLASSPATH_TOMCAT=%PATH_TOMCAT%\catalina-optional.jar;%PATH_TOMCAT%\catalina.jar;%PATH_TOMCAT%\commons-el.jar;%PATH_TOMCAT%\commons-logging-1.1.1.jar;%PATH_TOMCAT%\commons-modeler-2.0.1.jar;%PATH_TOMCAT%\jasper-compiler-jdt.jar;%PATH_TOMCAT%\jasper-compiler.jar;%PATH_TOMCAT%\jasper-runtime.jar;%PATH_TOMCAT%\jsp-api.jar;%PATH_TOMCAT%\naming-factory.jar;%PATH_TOMCAT%\naming-resources.jar;%PATH_TOMCAT%\servlet-api.jar;%PATH_TOMCAT%\servlets-default.jar;%PATH_TOMCAT%\tomcat-coyote.jar;%PATH_TOMCAT%\tomcat-http.jar;%PATH_TOMCAT%\tomcat-util.jar
set CLASSPATH_STS_GEN2=%PATH_LIB%\aopalliance-repackaged-2.6.1.jar;%PATH_LIB%\bcpkix-jdk15on-1.68.jar;%PATH_LIB%\bcprov-jdk15on-1.68.jar;%PATH_LIB%\grizzly-framework-2.4.4.jar;%PATH_LIB%\grizzly-http-2.4.4.jar;%PATH_LIB%\grizzly-http-server-2.4.4.jar;%PATH_LIB%\hibernate-validator-6.0.13.Final.jar;%PATH_LIB%\hk2-api-2.6.1.jar;%PATH_LIB%\hk2-locator-2.6.1.jar;%PATH_LIB%\hk2-utils-2.6.1.jar;%PATH_LIB%\jackson-annotations-2.14.1.jar;%PATH_LIB%\jackson-core-2.14.1.jar;%PATH_LIB%\jackson-databind-2.14.1.jar;%PATH_LIB%\jackson-databind-nullable-0.2.6.jar;%PATH_LIB%\javassist-3.22.0-CR2.jar;%PATH_LIB%\javax.activation-api-1.2.0.jar;%PATH_LIB%\javax.annotation-api-1.3.2.jar;%PATH_LIB%\javax.inject-1.jar;%PATH_LIB%\javax.ws.rs-api-2.1.1.jar;%PATH_LIB%\jboss-logging-3.3.2.Final.jar;%PATH_LIB%\jersey-client-2.39.jar;%PATH_LIB%\jersey-common-2.39.jar;%PATH_LIB%\jersey-container-grizzly2-http-2.39.jar;%PATH_LIB%\jersey-hk2-2.39.jar;%PATH_LIB%\jersey-media-json-jackson-2.39.jar;%PATH_LIB%\jersey-server-2.39.jar;%PATH_LIB%\swagger-annotations-1.5.0.jar;%PATH_LIB%\validation-api-2.0.1.Final.jar

jre\bin\java -version

rem jre\bin\java -Djava.library.path=.\bin\windows\ -Dos.arch=x86 -Duser.language=en -Duser.country=US -classpath "%CLASSPATH_AXIS%;%CLASSPATH_APP%;%CLASSPATH_BORLAND%;%CLASSPATH_TOMCAT%;%CLASSPATH_STS_GEN2%" -Dos.name="Windows XP" com.cccint.test.testtool.general.Main 

rem C:\PROGRA~1\Java\jdk-23\bin\java -Djava.library.path=.\bin\windows\ -Dos.arch=x86 -Duser.language=en -Duser.country=US -classpath "%CLASSPATH_AXIS%;%CLASSPATH_APP%;%CLASSPATH_BORLAND%;%CLASSPATH_TOMCAT%;%CLASSPATH_STS_GEN2%" -Dos.name="Windows XP" com.cccint.test.testtool.general.Main 
Start jre\bin\javaw -Djava.library.path=.\bin\windows\ -Duser.language=en -Duser.country=US -classpath "%CLASSPATH_AXIS%;%CLASSPATH_APP%;%CLASSPATH_BORLAND%;%CLASSPATH_TOMCAT%;%CLASSPATH_STS_GEN2%" -Dos.name="Windows XP" com.cccint.test.testtool.general.Main 
