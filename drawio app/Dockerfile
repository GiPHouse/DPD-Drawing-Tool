# ==========================================
# Stage 1: The Builder (Updated to Java 17)
# ==========================================
FROM eclipse-temurin:17-jdk-jammy AS build

# Install Ant
RUN apt-get update -y && \
    apt-get install -y ant

# Set a working directory inside the builder container
WORKDIR /app

# Copy your local project files into the container
COPY . .

# Run the Ant build script to create the .war file
WORKDIR /app/etc/build
RUN ant war

# ==========================================
# Stage 2: The Runner (Updated to Java 17)
# ==========================================
FROM tomcat:9.0-jdk17-temurin

# Add metadata
LABEL maintainer="Your Name <your.email@example.com>" \
      org.opencontainers.image.title="My Custom Draw.io" \
      org.opencontainers.image.source="Local Build"

# Clean out default Tomcat applications
RUN rm -rf /usr/local/tomcat/webapps/*

# Copy the compiled .war file from the 'builder' stage
COPY --from=build /app/build/draw.war /usr/local/tomcat/webapps/ROOT.war

# Expose the web server port
EXPOSE 8080

# Start Tomcat
CMD ["catalina.sh", "run"]