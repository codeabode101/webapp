#!/bin/bash
# TeaVM Maven project builder
# Creates a Maven project with TeaVM and compiles Java to JavaScript

PROJECT_DIR="$1"
MAIN_CLASS="$2"
CODE="$3"

if [ -z "$PROJECT_DIR" ] || [ -z "$MAIN_CLASS" ]; then
    echo "Usage: $0 <project_dir> <main_class> <code>"
    exit 1
fi

# Create Maven project structure
SRC_DIR="$PROJECT_DIR/src/main/java"
mkdir -p "$SRC_DIR"

# Write the Java source
echo "$CODE" > "$SRC_DIR/$MAIN_CLASS.java"

# Create pom.xml if it doesn't exist
if [ ! -f "$PROJECT_DIR/pom.xml" ]; then
    cat > "$PROJECT_DIR/pom.xml" << POMEOF
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.codeabode</groupId>
    <artifactId>game</artifactId>
    <version>1.0-SNAPSHOT</version>
    <packaging>jar</packaging>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.teavm</groupId>
            <artifactId>teavm-classlib</artifactId>
            <version>0.10.2</version>
        </dependency>
        <dependency>
            <groupId>org.teavm</groupId>
            <artifactId>teavm-jso-api</artifactId>
            <version>0.10.2</version>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>11</source>
                    <target>11</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.teavm</groupId>
                <artifactId>teavm-maven-plugin</artifactId>
                <version>0.10.2</version>
                <executions>
                    <execution>
                        <goals>
                            <goal>compile</goal>
                        </goals>
                        <configuration>
                            <mainClass>$MAIN_CLASS</mainClass>
                            <targetFileName>game.js</targetFileName>
                            <targetType>JAVASCRIPT</targetType>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
POMEOF
fi

# Build with Maven
cd "$PROJECT_DIR"
mvn clean package -DskipTests -q

# Check output
if [ -f "target/game.js" ]; then
    echo "SUCCESS"
    exit 0
else
    echo "FAILED"
    exit 1
fi